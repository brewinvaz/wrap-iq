import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.subscription import (
    PaymentMethodType,
    SubscriptionStatus,
)

# --- Plan ---


class PlanResponse(BaseModel):
    id: uuid.UUID
    name: str
    price_cents: int
    features: dict
    is_default: bool

    model_config = {"from_attributes": True}


# --- Subscription ---


class SubscriptionCreate(BaseModel):
    plan_id: uuid.UUID


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    plan_id: uuid.UUID
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    trial_end: datetime | None = None
    plan: PlanResponse | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Payment Method ---


class PaymentMethodCreate(BaseModel):
    type: PaymentMethodType = PaymentMethodType.CARD
    last_four: str
    brand: str = ""
    exp_month: int = 0
    exp_year: int = 0
    is_default: bool = False


class PaymentMethodResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    type: PaymentMethodType
    last_four: str
    brand: str
    exp_month: int
    exp_year: int
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Usage Metrics ---


class UsageMetrics(BaseModel):
    seats_used: int
    seats_limit: int
    storage_used_gb: float
    storage_limit_gb: float
    projects_count: int
