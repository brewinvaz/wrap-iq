import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.audit_log import ActionType


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID | None
    action: ActionType
    resource_type: str
    resource_id: uuid.UUID | None
    details: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    limit: int
    offset: int
