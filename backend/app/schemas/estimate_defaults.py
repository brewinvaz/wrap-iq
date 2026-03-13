import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class EstimateDefaultsCreate(BaseModel):
    job_type: str | None = None
    vehicle_count_min: int | None = None
    vehicle_count_max: int | None = None
    wrap_coverage: str | None = None
    vehicle_type: str | None = None
    design_hours: Decimal | None = Field(default=None, ge=0)
    production_hours: Decimal | None = Field(default=None, ge=0)
    install_hours: Decimal | None = Field(default=None, ge=0)
    priority: int = 0
    is_active: bool = True


class EstimateDefaultsUpdate(BaseModel):
    job_type: str | None = None
    vehicle_count_min: int | None = None
    vehicle_count_max: int | None = None
    wrap_coverage: str | None = None
    vehicle_type: str | None = None
    design_hours: Decimal | None = Field(default=None, ge=0)
    production_hours: Decimal | None = Field(default=None, ge=0)
    install_hours: Decimal | None = Field(default=None, ge=0)
    priority: int | None = None
    is_active: bool | None = None


class EstimateDefaultsResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    job_type: str | None = None
    vehicle_count_min: int | None = None
    vehicle_count_max: int | None = None
    wrap_coverage: str | None = None
    vehicle_type: str | None = None
    design_hours: Decimal | None = None
    production_hours: Decimal | None = None
    install_hours: Decimal | None = None
    priority: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EstimateDefaultsListResponse(BaseModel):
    items: list[EstimateDefaultsResponse]
    total: int
