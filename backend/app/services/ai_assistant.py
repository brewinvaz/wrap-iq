import re
import uuid

import sqlparse
from google import genai
from google.genai import types
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import engine
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
     system_status (ENUM: LEAD, IN_PROGRESS, COMPLETED, CANCELLED),
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

_EXECUTE_SQL_TOOL = types.FunctionDeclaration(
    name="execute_sql",
    description="Execute a read-only SQL query against the database",
    parameters={
        "type": "OBJECT",
        "properties": {
            "sql": {
                "type": "STRING",
                "description": (
                    "A SELECT query. Must include "
                    "WHERE organization_id = :org_id "
                    "for tenant isolation."
                ),
            },
            "explanation": {
                "type": "STRING",
                "description": "Brief explanation of what this query does",
            },
        },
        "required": ["sql", "explanation"],
    },
)


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
- Use the execute_sql function when you need to query data.
- If the question can be answered without a query, answer directly.
- When summarizing results, be concise and helpful.
- Dates should be presented in a human-readable format.
- A job is "late" if estimated_completion_date < NOW() and completion_date IS NULL
  and the kanban_stages.system_status is 'in_progress'.
"""


def _strip_sql_comments(sql: str) -> str:
    """Remove SQL comments (both -- line comments and /* block comments */)."""
    # Remove block comments
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    # Remove line comments
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql


def validate_sql(sql: str) -> str | None:
    """Validate that SQL is safe to execute.

    Returns an error message if the SQL is unsafe, or None if it is valid.
    """
    # Strip comments before validation to prevent bypass
    cleaned = _strip_sql_comments(sql)
    stripped = cleaned.strip().rstrip(";").strip()

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


_MAX_LIMIT = 1000
_DEFAULT_LIMIT = 100


def _get_outermost_limit(sql: str) -> int | None:
    """Return the LIMIT value of the outermost SELECT, or None if absent.

    Uses sqlparse to find the LIMIT clause at the top level of the statement,
    skipping any LIMIT clauses inside parenthesized subqueries or UNION
    members so they cannot bypass the check.
    """
    parsed = sqlparse.parse(sql)
    if not parsed:
        return None
    stmt = parsed[-1]  # last (and typically only) statement

    # Collect only top-level (non-parenthesized) tokens by walking
    # the statement's direct children and skipping Parenthesis groups.
    top_tokens: list[sqlparse.sql.Token] = []
    for token in stmt.tokens:
        if isinstance(token, sqlparse.sql.Parenthesis):
            continue  # skip subqueries wrapped in parentheses
        if token.ttype is not None:
            top_tokens.append(token)
        else:
            # For non-leaf groups (e.g. Identifier, Where, etc.)
            # flatten them but they are still at the outer level
            top_tokens.extend(token.flatten())

    # Walk in reverse to find the last LIMIT keyword at top level
    for i in range(len(top_tokens) - 1, -1, -1):
        tok = top_tokens[i]
        if tok.ttype is sqlparse.tokens.Keyword and tok.normalized == "LIMIT":
            # Next non-whitespace token should be the limit value
            for j in range(i + 1, len(top_tokens)):
                next_tok = top_tokens[j]
                if next_tok.ttype in (
                    sqlparse.tokens.Literal.Number.Integer,
                    sqlparse.tokens.Literal.Number.Float,
                ):
                    try:
                        return int(next_tok.value)
                    except ValueError:
                        return None
                if next_tok.ttype not in (
                    sqlparse.tokens.Whitespace,
                    sqlparse.tokens.Newline,
                ):
                    break
            return None
    return None


def ensure_outer_limit(sql: str) -> str:
    """Ensure the outermost query has a reasonable LIMIT clause.

    - If no LIMIT exists on the outermost query, appends LIMIT 100.
    - If the LIMIT exceeds _MAX_LIMIT, replaces it with _MAX_LIMIT.
    - Returns the (possibly modified) SQL string.
    """
    cleaned = sql.strip().rstrip(";").strip()
    limit_value = _get_outermost_limit(cleaned)

    if limit_value is None:
        return cleaned + f" LIMIT {_DEFAULT_LIMIT}"

    if limit_value > _MAX_LIMIT:
        # Replace the excessive limit with the maximum allowed
        # We use sqlparse to locate and rewrite only the outermost LIMIT
        parsed = sqlparse.parse(cleaned)
        stmt = parsed[-1]
        tokens = list(stmt.flatten())
        for i in range(len(tokens) - 1, -1, -1):
            tok = tokens[i]
            if tok.ttype is sqlparse.tokens.Keyword and tok.normalized == "LIMIT":
                for j in range(i + 1, len(tokens)):
                    next_tok = tokens[j]
                    if next_tok.ttype in (
                        sqlparse.tokens.Literal.Number.Integer,
                        sqlparse.tokens.Literal.Number.Float,
                    ):
                        next_tok.value = str(_MAX_LIMIT)
                        # Rebuild the SQL from the modified token list
                        return str(stmt)
                break
        # Fallback: regex replacement for the last LIMIT N
        return re.sub(
            r"LIMIT\s+\d+\s*$",
            f"LIMIT {_MAX_LIMIT}",
            cleaned,
            flags=re.IGNORECASE,
        )

    return cleaned


class AIAssistantService:
    # In-memory conversation history keyed by conversation_id.
    # Each entry is a list of Content objects representing the chat turns.
    _conversations: dict[uuid.UUID, list[types.Content]] = {}

    def __init__(self) -> None:
        if not settings.gemini_api_key:
            msg = "Gemini API key is not configured"
            raise ValueError(msg)
        self._client = genai.Client(api_key=settings.gemini_api_key)

    async def answer_question(
        self,
        question: str,
        user: User,
        session: AsyncSession,
        *,
        conversation_id: uuid.UUID | None = None,
    ) -> QueryResponse:
        # Reuse existing conversation or start a new one
        if conversation_id and conversation_id in self._conversations:
            history = self._conversations[conversation_id]
        else:
            conversation_id = conversation_id or uuid.uuid4()
            history = []
            self._conversations[conversation_id] = history

        system_prompt = _build_system_prompt(user)

        # Append the new user message to conversation history
        user_content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=question)],
        )
        history.append(user_content)

        # First call: ask Gemini to answer or generate SQL via function calling
        response = await self._client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=[types.Tool(function_declarations=[_EXECUTE_SQL_TOOL])],
            ),
        )

        # Check if Gemini wants to call a function
        function_call = None
        text_parts = []
        for part in response.candidates[0].content.parts:
            if part.function_call and part.function_call.name == "execute_sql":
                function_call = part.function_call
            elif part.text:
                text_parts.append(part.text)

        # If no function call, return the text answer directly
        if function_call is None:
            answer_text = (
                "\n".join(text_parts)
                if text_parts
                else "I could not generate an answer."
            )
            # Store model response in conversation history
            history.append(
                types.Content(
                    role="model",
                    parts=[types.Part.from_text(text=answer_text)],
                )
            )
            return QueryResponse(
                answer=answer_text,
                conversation_id=conversation_id,
            )

        sql = function_call.args.get("sql", "")
        explanation = function_call.args.get("explanation", "")

        # Validate SQL safety
        validation_error = validate_sql(sql)
        if validation_error:
            return QueryResponse(
                answer=f"I generated an unsafe query and caught it: {validation_error}",
                conversation_id=conversation_id,
            )

        # Strip comments from SQL before LIMIT check and execution
        sql = _strip_sql_comments(sql).strip().rstrip(";").strip()

        # Ensure the outermost query has a reasonable LIMIT
        sql = ensure_outer_limit(sql)

        # Execute the query using a read-only connection for safety
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SET TRANSACTION READ ONLY"))
                result = await conn.execute(
                    text(sql), {"org_id": str(user.organization_id)}
                )
                rows = [dict(row._mapping) for row in result.fetchall()]
        except Exception as exc:
            return QueryResponse(
                answer=f"I tried to query the database but encountered an error: {exc}",
                query_executed=sql,
                conversation_id=conversation_id,
            )

        # Second call: have Gemini summarize the results
        summary_prompt = (
            f"Original question: {question}\n\n"
            f"Query explanation: {explanation}\n"
            f"SQL executed: {sql}\n\n"
            f"Results: {_format_results(rows)}\n\n"
            "Please provide a concise, helpful summary of these results."
        )

        summary_response = await self._client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=summary_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
            ),
        )

        answer_parts = []
        for part in summary_response.candidates[0].content.parts:
            if part.text:
                answer_parts.append(part.text)

        final_answer = (
            "\n".join(answer_parts) if answer_parts else "No summary available."
        )

        # Store model response in conversation history
        history.append(
            types.Content(
                role="model",
                parts=[types.Part.from_text(text=final_answer)],
            )
        )

        return QueryResponse(
            answer=final_answer,
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
