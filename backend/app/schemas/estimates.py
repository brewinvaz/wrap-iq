import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.estimate import EstimateStatus


class LineItemCreate(BaseModel):
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: int


class LineItemUpdate(BaseModel):
    description: str | None = None
    quantity: Decimal | None = None
    unit_price: int | None = None
    sort_order: int | None = None


class LineItemResponse(BaseModel):
    id: uuid.UUID
    estimate_id: uuid.UUID
    description: str
    quantity: Decimal
    unit_price: int
    total: int
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EstimateCreate(BaseModel):
    client_name: str
    client_email: str
    work_order_id: uuid.UUID | None = None
    tax_rate: Decimal = Decimal("0")
    notes: str | None = None
    valid_until: datetime | None = None
    line_items: list[LineItemCreate] = []


class EstimateUpdate(BaseModel):
    client_name: str | None = None
    client_email: str | None = None
    tax_rate: Decimal | None = None
    notes: str | None = None
    valid_until: datetime | None = None


class EstimateResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    work_order_id: uuid.UUID | None = None
    client_email: str
    client_name: str
    estimate_number: str
    status: EstimateStatus
    subtotal: int
    tax_rate: Decimal
    tax_amount: int
    total: int
    notes: str | None = None
    valid_until: datetime | None = None
    sent_at: datetime | None = None
    responded_at: datetime | None = None
    line_items: list[LineItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EstimateListResponse(BaseModel):
    items: list[EstimateResponse]
    total: int
