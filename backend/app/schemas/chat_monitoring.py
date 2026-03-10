import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    text: str = Field(..., min_length=1)
    author: str
    timestamp: datetime | None = None
    channel: str | None = None


class SuggestedUpdate(BaseModel):
    work_order_id: uuid.UUID
    work_order_job_number: str
    field_to_update: str
    suggested_value: str
    reason: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class ChatAnalysisResponse(BaseModel):
    message_relevant: bool
    suggested_updates: list[SuggestedUpdate] = []
    raw_analysis: str | None = None


ALLOWED_UPDATE_FIELDS = {"internal_notes", "priority", "estimated_completion_date"}


class ApplyUpdateRequest(BaseModel):
    work_order_id: uuid.UUID
    field_to_update: str = Field(
        ...,
        pattern="^(internal_notes|priority|estimated_completion_date)$",
    )
    value: str


class ApplyUpdateResponse(BaseModel):
    success: bool
    message: str
