import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.kanban_stage import SystemStatus
from app.models.work_order import JobType, Priority


class WorkOrderCreate(BaseModel):
    job_type: JobType = JobType.PERSONAL
    job_value: int = 0
    priority: Priority = Priority.MEDIUM
    date_in: datetime
    estimated_completion_date: datetime | None = None
    internal_notes: str | None = None
    vehicle_ids: list[uuid.UUID] = []


class WorkOrderUpdate(BaseModel):
    job_type: JobType | None = None
    job_value: int | None = None
    priority: Priority | None = None
    estimated_completion_date: datetime | None = None
    internal_notes: str | None = None


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkOrderListResponse(BaseModel):
    items: list[WorkOrderResponse]
    total: int
