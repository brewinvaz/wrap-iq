import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TaskPresetCreate(BaseModel):
    phase: str
    name: str = Field(max_length=255)
    sort_order: int = 0


class TaskPresetUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    sort_order: int | None = None
    is_active: bool | None = None


class TaskPresetResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    phase: str
    name: str
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskPresetListResponse(BaseModel):
    items: list[TaskPresetResponse]
    total: int
