import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.equipment import EquipmentType


class EquipmentCreate(BaseModel):
    name: str
    serial_number: str | None = None
    equipment_type: EquipmentType
    is_active: bool = True


class EquipmentUpdate(BaseModel):
    name: str | None = None
    serial_number: str | None = None
    equipment_type: EquipmentType | None = None
    is_active: bool | None = None


class EquipmentResponse(BaseModel):
    id: uuid.UUID
    name: str
    serial_number: str | None
    equipment_type: EquipmentType
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EquipmentListResponse(BaseModel):
    items: list[EquipmentResponse]
    total: int


class EquipmentStats(BaseModel):
    total: int
    active: int
    printers: int
    other: int
