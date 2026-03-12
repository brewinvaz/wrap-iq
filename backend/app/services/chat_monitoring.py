import json
import logging
from datetime import UTC, datetime

from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.models.work_order import WorkOrder
from app.schemas.chat_monitoring import (
    ALLOWED_UPDATE_FIELDS,
    ApplyUpdateRequest,
    ApplyUpdateResponse,
    ChatAnalysisResponse,
    ChatMessage,
    SuggestedUpdate,
)

logger = logging.getLogger(__name__)

_ANALYSIS_PROMPT = (
    "You are a chat monitoring assistant for WrapIQ, "
    "a vehicle wrap shop management system.\n"
    "Analyze the following chat message and determine "
    "if it relates to any of the listed work orders.\n"
    "\n"
    "Chat message:\n"
    "Author: {author}\n"
    "Channel: {channel}\n"
    "Timestamp: {timestamp}\n"
    "Text: {text}\n"
    "\n"
    "Active work orders:\n"
    "{work_orders_context}\n"
    "\n"
    "Return ONLY valid JSON (no markdown, no code fences) "
    "with these fields:\n"
    '- "message_relevant": boolean\n'
    '- "suggested_updates": array of objects, each with:\n'
    '  - "work_order_id": string UUID of the matched work order\n'
    '  - "work_order_job_number": string job number\n'
    '  - "field_to_update": one of "internal_notes", "priority", '
    '"estimated_completion_date"\n'
    '  - "suggested_value": the value to set '
    "(for internal_notes, provide the note text to append; "
    'for priority, one of "high", "medium", "low"; '
    "for estimated_completion_date, an ISO datetime)\n"
    '  - "reason": brief explanation of why this update '
    "is suggested\n"
    '  - "confidence": float between 0 and 1\n'
    "\n"
    "If the message is not relevant to any work order, "
    'set "message_relevant" to false '
    'and "suggested_updates" to an empty array.'
)

_SYSTEM_INSTRUCTION = "You are a JSON-only responder. Return only valid JSON."


class ChatMonitoringService:
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            msg = "Gemini API key is not configured"
            raise ValueError(msg)
        self._client = genai.Client(api_key=settings.gemini_api_key)

    async def analyze_message(
        self,
        message: ChatMessage,
        user: User,
        session: AsyncSession,
    ) -> ChatAnalysisResponse:
        stmt = (
            select(
                WorkOrder.id,
                WorkOrder.job_number,
                WorkOrder.internal_notes,
            )
            .where(WorkOrder.organization_id == user.organization_id)
            .order_by(WorkOrder.updated_at.desc())
            .limit(50)
        )
        result = await session.execute(stmt)
        work_orders = result.all()

        if not work_orders:
            return ChatAnalysisResponse(
                message_relevant=False,
                suggested_updates=[],
                raw_analysis="No work orders found for this organization.",
            )

        wo_lines = []
        for wo in work_orders:
            notes_preview = (wo.internal_notes or "")[:100]
            wo_lines.append(
                f"- ID: {wo.id}, Job#: {wo.job_number}, Notes: {notes_preview}"
            )
        work_orders_context = "\n".join(wo_lines)

        timestamp = message.timestamp or datetime.now(tz=UTC)
        prompt = _ANALYSIS_PROMPT.format(
            author=message.author,
            channel=message.channel or "general",
            timestamp=timestamp.isoformat(),
            text=message.text,
            work_orders_context=work_orders_context,
        )

        response = await self._client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_INSTRUCTION,
            ),
        )

        raw_text = response.text
        return _parse_analysis_response(raw_text)

    async def apply_update(
        self,
        request: ApplyUpdateRequest,
        user: User,
        session: AsyncSession,
    ) -> ApplyUpdateResponse:
        if request.field_to_update not in ALLOWED_UPDATE_FIELDS:
            return ApplyUpdateResponse(
                success=False,
                message=(
                    f"Field '{request.field_to_update}' is not allowed for updates."
                ),
            )

        stmt = select(WorkOrder).where(
            WorkOrder.id == request.work_order_id,
            WorkOrder.organization_id == user.organization_id,
        )
        result = await session.execute(stmt)
        work_order = result.scalar_one_or_none()

        if work_order is None:
            return ApplyUpdateResponse(
                success=False,
                message=(
                    "Work order not found or does not belong to your organization."
                ),
            )

        if request.field_to_update == "internal_notes":
            ts = datetime.now(tz=UTC).strftime("%Y-%m-%d %H:%M UTC")
            note_entry = f"\n[{ts}] [AI suggested] {request.value}"
            current_notes = work_order.internal_notes or ""
            work_order.internal_notes = current_notes + note_entry
        elif request.field_to_update == "priority":
            allowed_priorities = {"high", "medium", "low"}
            if request.value not in allowed_priorities:
                return ApplyUpdateResponse(
                    success=False,
                    message=(
                        f"Invalid priority '{request.value}'. "
                        f"Must be one of: {', '.join(sorted(allowed_priorities))}."
                    ),
                )
            work_order.priority = request.value
        elif request.field_to_update == "estimated_completion_date":
            try:
                parsed_date = datetime.fromisoformat(request.value)
            except ValueError:
                logger.warning(
                    "Invalid datetime value for estimated_completion_date: %s",
                    request.value,
                )
                return ApplyUpdateResponse(
                    success=False,
                    message=(
                        f"Invalid datetime format '{request.value}'. "
                        "Expected an ISO 8601 datetime string "
                        "(e.g. '2025-06-15T14:00:00')."
                    ),
                )
            work_order.estimated_completion_date = parsed_date

        await session.commit()

        job_num = work_order.job_number
        field = request.field_to_update
        return ApplyUpdateResponse(
            success=True,
            message=(f"Successfully updated '{field}' on work order {job_num}."),
        )


def _parse_analysis_response(raw_text: str) -> ChatAnalysisResponse:
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning(
            "Failed to parse Gemini response as JSON: %s",
            raw_text,
        )
        return ChatAnalysisResponse(
            message_relevant=False,
            suggested_updates=[],
            raw_analysis=raw_text,
        )

    suggested_updates = []
    for item in data.get("suggested_updates", []):
        try:
            suggested_updates.append(
                SuggestedUpdate(
                    work_order_id=item["work_order_id"],
                    work_order_job_number=item["work_order_job_number"],
                    field_to_update=item["field_to_update"],
                    suggested_value=item["suggested_value"],
                    reason=item["reason"],
                    confidence=max(
                        0.0,
                        min(1.0, float(item.get("confidence", 0))),
                    ),
                )
            )
        except (KeyError, ValueError) as exc:
            logger.warning("Skipping malformed suggested update: %s", exc)
            continue

    return ChatAnalysisResponse(
        message_relevant=data.get("message_relevant", False),
        suggested_updates=suggested_updates,
        raw_analysis=raw_text,
    )
