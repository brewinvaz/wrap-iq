import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.vehicle import VehicleType


class VehicleCreate(BaseModel):
    vin: str | None = None
    year: int | None = None
    make: str | None = None
    model: str | None = None
    paint_color: str | None = None
    vehicle_unit_number: str | None = None
    vehicle_type: VehicleType | None = None
    truck_cab_size: str | None = None
    truck_bed_length: str | None = None
    van_roof_height: str | None = None
    van_wheelbase: str | None = None
    van_length: str | None = None


class VehicleUpdate(BaseModel):
    vin: str | None = None
    year: int | None = None
    make: str | None = None
    model: str | None = None
    paint_color: str | None = None
    vehicle_unit_number: str | None = None
    vehicle_type: VehicleType | None = None
    truck_cab_size: str | None = None
    truck_bed_length: str | None = None
    van_roof_height: str | None = None
    van_wheelbase: str | None = None
    van_length: str | None = None


class VehicleResponse(BaseModel):
    id: uuid.UUID
    vin: str | None = None
    year: int | None = None
    make: str | None = None
    model: str | None = None
    paint_color: str | None = None
    vehicle_unit_number: str | None = None
    vehicle_type: VehicleType | None = None
    truck_cab_size: str | None = None
    truck_bed_length: str | None = None
    van_roof_height: str | None = None
    van_wheelbase: str | None = None
    van_length: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VehicleListResponse(BaseModel):
    items: list[VehicleResponse]
    total: int
