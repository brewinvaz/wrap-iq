import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.invoice import InvoiceStatus


class PaymentCreate(BaseModel):
    amount: int
    payment_method: str | None = None
    reference: str | None = None
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    invoice_id: uuid.UUID
    amount: int
    payment_method: str | None = None
    reference: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    client_name: str
    client_email: str
    subtotal: int
    tax_rate: Decimal = Decimal("0")
    due_date: datetime | None = None
    work_order_id: uuid.UUID | None = None
    estimate_id: uuid.UUID | None = None
    notes: str | None = None


class InvoiceUpdate(BaseModel):
    client_name: str | None = None
    client_email: str | None = None
    due_date: datetime | None = None
    notes: str | None = None


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    estimate_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    invoice_number: str
    client_email: str
    client_name: str
    status: InvoiceStatus
    subtotal: int
    tax_rate: Decimal
    tax_amount: int
    total: int
    amount_paid: int
    balance_due: int
    due_date: datetime | None = None
    notes: str | None = None
    payment_link: str | None = None
    payments: list[PaymentResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse]
    total: int
