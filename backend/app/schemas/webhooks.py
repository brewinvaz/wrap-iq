import ipaddress
import uuid
from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, field_serializer, field_validator

# Private/internal network ranges that must be blocked to prevent SSRF
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _validate_webhook_url(url: str) -> str:
    """Validate that a webhook URL is safe (not targeting internal/private networks)."""
    parsed = urlparse(url)

    # Only allow http and https schemes
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Webhook URL must use http:// or https:// scheme")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Webhook URL must include a valid hostname")

    # Block localhost variants
    if hostname in ("localhost", "0.0.0.0"):  # noqa: S104
        raise ValueError("Webhook URL must not point to a private or internal address")

    # If hostname is a literal IP address, check against blocked ranges
    try:
        ip = ipaddress.ip_address(hostname)
        for network in _BLOCKED_NETWORKS:
            if ip in network:
                raise ValueError(
                    "Webhook URL must not point to a private"
                    " or internal network address"
                )
    except ValueError:
        # Not an IP literal — it's a regular hostname, which is fine
        pass

    return url


class WebhookCreate(BaseModel):
    name: str
    url: str
    events: list[str]
    description: str | None = None
    is_active: bool = True

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        return _validate_webhook_url(v)


class WebhookUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    events: list[str] | None = None
    description: str | None = None
    is_active: bool | None = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is not None:
            return _validate_webhook_url(v)
        return v


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
