import re
import uuid

import anthropic
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.schemas.ai_assistant import QueryResponse

# SQL keywords that indicate a write operation
_DANGEROUS_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|EXEC)\b",
    re.IGNORECASE,
)

_SCHEMA_DESCRIPTION = """\
Available tables and columns (PostgreSQL):

1. work_orders
   - id (UUID, PK), organization_id (UUID, FK to organizations),
     job_number (VARCHAR), job_type (ENUM: commercial, personal),
     job_value (INTEGER, cents), status_id (UUID, FK to kanban_stages),
     priority (ENUM: high, medium, low),
     date_in (TIMESTAMPTZ), estimated_completion_date (TIMESTAMPTZ),
     completion_date (TIMESTAMPTZ), internal_notes (TEXT),
     created_at, updated_at

2. kanban_stages
   - id (UUID, PK), organization_id (UUID, FK to organizations),
     name (VARCHAR), color (VARCHAR), position (INTEGER),
     system_status (ENUM: lead, in_progress, completed, cancelled),
     is_default (BOOLEAN), is_active (BOOLEAN),
     created_at, updated_at

3. vehicles
   - id (UUID, PK), organization_id (UUID, FK to organizations),
     vin (VARCHAR), year (INTEGER), make (VARCHAR), model (VARCHAR),
     vehicle_unit_number (VARCHAR),
     vehicle_type (ENUM: car, suv, pickup, van, utility_van, box_truck, semi, trailer),
     created_at, updated_at

4. work_order_vehicles (join table)
   - work_order_id (UUID, FK to work_orders),
     vehicle_id (UUID, FK to vehicles),
     created_at

5. users
   - id (UUID, PK), organization_id (UUID, FK to organizations),
     email (VARCHAR),
     role (ENUM: admin, project_manager, installer,
           designer, production, client),
     is_active (BOOLEAN), created_at, updated_at

6. organizations
   - id (UUID, PK), name (VARCHAR), slug (VARCHAR),
     plan_id (UUID, FK to plans), is_active (BOOLEAN),
     created_at, updated_at
"""

_EXECUTE_SQL_TOOL = {
    "name": "execute_sql",
    "description": "Execute a read-only SQL query against the database",
    "input_schema": {
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": (
                    "A SELECT query. Must include "
                    "WHERE organization_id = :org_id "
                    "for tenant isolation."
                ),
            },
            "explanation": {
                "type": "string",
                "description": "Brief explanation of what this query does",
            },
        },
        "required": ["sql", "explanation"],
    },
}


def _build_system_prompt(user: User) -> str:
    return f"""\
You are a helpful assistant for WrapIQ, a vehicle wrap shop management system.
You answer questions about work orders, vehicles, schedules, and KPIs.

Current user role: {user.role.value}
Organization ID: {user.organization_id}

{_SCHEMA_DESCRIPTION}

RULES:
- Only generate SELECT queries. Never INSERT, UPDATE, DELETE, or any DDL.
- ALWAYS filter by organization_id = :org_id for tenant data isolation.
- Add LIMIT 100 to queries unless the user asks for a specific count.
- Use the execute_sql tool when you need to query data.
- If the question can be answered without a query, answer directly.
- When summarizing results, be concise and helpful.
- Dates should be presented in a human-readable format.
- A job is "late" if estimated_completion_date < NOW() and completion_date IS NULL
  and the kanban_stages.system_status is 'in_progress'.
"""


def validate_sql(sql: str) -> str | None:
    """Validate that SQL is safe to execute.

    Returns an error message if the SQL is unsafe, or None if it is valid.
    """
    stripped = sql.strip().rstrip(";").strip()

    # Must be a SELECT statement
    if not stripped.upper().startswith("SELECT"):
        return "Only SELECT statements are allowed."

    # Check for dangerous keywords
    if _DANGEROUS_KEYWORDS.search(stripped):
        return "Query contains disallowed keywords."

    # Must reference org_id parameter for tenant isolation
    if ":org_id" not in stripped and "organization_id" not in stripped.lower():
        return "Query must filter by organization_id for tenant isolation."

    return None


class AIAssistantService:
    def __init__(self) -> None:
        if not settings.anthropic_api_key:
            msg = "Anthropic API key is not configured"
            raise ValueError(msg)
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def answer_question(
        self,
        question: str,
        user: User,
        session: AsyncSession,
    ) -> QueryResponse:
        conversation_id = uuid.uuid4()
        system_prompt = _build_system_prompt(user)

        # First call: ask Claude to answer or generate SQL
        response = await self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            tools=[_EXECUTE_SQL_TOOL],
            messages=[{"role": "user", "content": question}],
        )

        # Check if Claude wants to execute SQL
        tool_use_block = None
        text_blocks = []
        for block in response.content:
            if block.type == "tool_use" and block.name == "execute_sql":
                tool_use_block = block
            elif block.type == "text":
                text_blocks.append(block.text)

        # If no tool use, return the text answer directly
        if tool_use_block is None:
            return QueryResponse(
                answer=(
                    "\n".join(text_blocks)
                    if text_blocks
                    else "I could not generate an answer."
                ),
                conversation_id=conversation_id,
            )

        sql = tool_use_block.input.get("sql", "")
        explanation = tool_use_block.input.get("explanation", "")

        # Validate SQL safety
        validation_error = validate_sql(sql)
        if validation_error:
            return QueryResponse(
                answer=f"I generated an unsafe query and caught it: {validation_error}",
                conversation_id=conversation_id,
            )

        # Ensure LIMIT exists
        if "limit" not in sql.lower():
            sql = sql.rstrip(";").strip() + " LIMIT 100"

        # Execute the query
        try:
            result = await session.execute(
                text(sql), {"org_id": str(user.organization_id)}
            )
            rows = [dict(row._mapping) for row in result.fetchall()]
        except Exception as exc:
            return QueryResponse(
                answer=f"I tried to query the database but encountered an error: {exc}",
                query_executed=sql,
                conversation_id=conversation_id,
            )

        # Second call: have Claude summarize the results
        summary_messages = [
            {"role": "user", "content": question},
            {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": f"I'll query the database. {explanation}"},
                    tool_use_block.model_dump(),
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use_block.id,
                        "content": _format_results(rows),
                    }
                ],
            },
        ]

        summary_response = await self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            tools=[_EXECUTE_SQL_TOOL],
            messages=summary_messages,
        )

        answer_parts = []
        for block in summary_response.content:
            if block.type == "text":
                answer_parts.append(block.text)

        return QueryResponse(
            answer="\n".join(answer_parts) if answer_parts else "No summary available.",
            query_executed=sql,
            data=rows if rows else None,
            conversation_id=conversation_id,
        )


def _format_results(rows: list[dict]) -> str:
    if not rows:
        return "The query returned no results."
    if len(rows) == 1:
        return f"1 row returned: {rows[0]}"
    return f"{len(rows)} rows returned: {rows[:20]}"
