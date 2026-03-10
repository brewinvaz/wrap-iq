import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.kanban_stage import SystemStatus
from app.models.work_order import JobType, Priority


class WorkOrderCreate(BaseModel):
    job_type: JobType = JobType.personal
    job_value: int = 0
    priority: Priority = Priority.medium
    date_in: datetime
    estimated_completion_date: datetime | None = None
    internal_notes: str | None = None
    vehicle_ids: list[uuid.UUID] = []
    client_id: uuid.UUID | None = None

    @field_validator("client_id", mode="before")
    @classmethod
    def coerce_client_id(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            try:
                return uuid.UUID(v)
            except ValueError:
                raise ValueError("client_id must be a valid UUID")  # noqa: B904
        return v


class WorkOrderUpdate(BaseModel):
    job_type: JobType | None = None
    job_value: int | None = None
    priority: Priority | None = None
    estimated_completion_date: datetime | None = None
    internal_notes: str | None = None
    client_id: uuid.UUID | None = None

    @field_validator("client_id", mode="before")
    @classmethod
    def coerce_client_id(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            try:
                return uuid.UUID(v)
            except ValueError:
                raise ValueError("client_id must be a valid UUID")  # noqa: B904
        return v


class StatusUpdate(BaseModel):
    status_id: uuid.UUID


class VehicleInWorkOrder(BaseModel):
    id: uuid.UUID
    make: str | None = None
    model: str | None = None
    year: int | None = None
    vin: str | None = None

    model_config = {"from_attributes": True}


class KanbanStageResponse(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    system_status: SystemStatus | None = None

    model_config = {"from_attributes": True}


class WorkOrderResponse(BaseModel):
    id: uuid.UUID
    job_number: str
    job_type: JobType
    job_value: int
    priority: Priority
    date_in: datetime
    estimated_completion_date: datetime | None = None
    completion_date: datetime | None = None
    internal_notes: str | None = None
    status: KanbanStageResponse | None = None
    vehicles: list[VehicleInWorkOrder] = []
    client_id: uuid.UUID | None = None
    client_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkOrderListResponse(BaseModel):
    items: list[WorkOrderResponse]
    total: int
