import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class TimeLogCreate(BaseModel):
    work_order_id: uuid.UUID | None = None
    task: str = Field(max_length=255)
    hours: Decimal = Field(gt=0, le=24)
    log_date: date
    phase: str | None = None
    notes: str | None = None


class TimeLogUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None = None

    model_config = {"from_attributes": True}


class TimeLogWorkOrderResponse(BaseModel):
    id: uuid.UUID
    job_number: str

    model_config = {"from_attributes": True}


class TimeLogResponse(BaseModel):
    id: uuid.UUID
    user: TimeLogUserResponse
    work_order: TimeLogWorkOrderResponse | None = None
    task: str
    hours: Decimal
    log_date: date
    status: str
    phase: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TimeLogUpdate(BaseModel):
    task: str | None = None
    hours: Decimal | None = Field(default=None, gt=0, le=24)
    log_date: date | None = None
    phase: str | None = None
    notes: str | None = None
    work_order_id: uuid.UUID | None = None


class TimeLogListResponse(BaseModel):
    items: list[TimeLogResponse]
    total: int


class TimeLogSummaryResponse(BaseModel):
    total_hours: Decimal
    pending_hours: Decimal
    approved_hours: Decimal
    unique_members: int
