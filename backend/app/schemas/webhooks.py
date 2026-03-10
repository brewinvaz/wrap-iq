import uuid
from datetime import datetime

from pydantic import BaseModel, field_serializer


class WebhookCreate(BaseModel):
    name: str
    url: str
    events: list[str]
    description: str | None = None
    is_active: bool = True


class WebhookUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    events: list[str] | None = None
    description: str | None = None
    is_active: bool | None = None


def _mask_secret(value: str) -> str:
    if len(value) <= 4:
        return "****"
    return "****" + value[-4:]


class WebhookResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    url: str
    secret: str
    events: list[str]
    is_active: bool
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_serializer("secret")
    def mask_secret(self, value: str) -> str:
        return _mask_secret(value)


class WebhookCreateResponse(BaseModel):
    """Returned only at creation time and secret regeneration — shows full secret."""
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    url: str
    secret: str
    events: list[str]
    is_active: bool
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class WebhookListResponse(BaseModel):
    items: list[WebhookResponse]
    total: int


class WebhookDeliveryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    webhook_id: uuid.UUID
    event_type: str
    payload: dict
    response_status: int | None = None
    success: bool
    error_message: str | None = None
    delivered_at: datetime | None = None
    created_at: datetime


class WebhookDeliveryListResponse(BaseModel):
    items: list[WebhookDeliveryResponse]
    total: int


class WebhookTestRequest(BaseModel):
    pass


class IncomingWebhookPayload(BaseModel):
    event: str
    data: dict
