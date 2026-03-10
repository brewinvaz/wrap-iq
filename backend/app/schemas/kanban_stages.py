import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.kanban_stage import SystemStatus


class KanbanStageCreate(BaseModel):
    name: str = Field(max_length=255)
    color: str = Field(default="#64748b", max_length=7)
    position: int = Field(default=0, ge=0)
    system_status: SystemStatus | None = None
    is_default: bool = False


class KanbanStageUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    color: str | None = Field(default=None, max_length=7)
    position: int | None = Field(default=None, ge=0)
    system_status: SystemStatus | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class KanbanStageResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    color: str
    position: int
    system_status: SystemStatus | None
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    id: uuid.UUID
    position: int = Field(ge=0)


class ReorderRequest(BaseModel):
    stages: list[ReorderItem]
