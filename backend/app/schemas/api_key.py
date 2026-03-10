import uuid
from datetime import datetime

from pydantic import BaseModel, Field

AVAILABLE_SCOPES = [
    "projects:read",
    "projects:write",
    "clients:read",
    "clients:write",
    "calendar:read",
    "calendar:write",
    "team:read",
    "team:write",
    "billing:read",
    "webhooks:manage",
]


class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scopes: list[str] = Field(default_factory=list)
    rate_limit_per_minute: int = Field(default=60, ge=1, le=10000)
    rate_limit_per_day: int = Field(default=10000, ge=1, le=1000000)
    expires_at: datetime | None = None


class APIKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str]
    rate_limit_per_minute: int
    rate_limit_per_day: int
    is_active: bool
    last_used_at: datetime | None
    expires_at: datetime | None
    created_by: uuid.UUID
    created_at: datetime
    revoked_at: datetime | None
    usage_count: int = 0

    model_config = {"from_attributes": True}


class APIKeyCreatedResponse(APIKeyResponse):
    full_key: str


class APIKeyRotateResponse(APIKeyCreatedResponse):
    pass


class APIKeyUsageStats(BaseModel):
    total_requests: int
    requests_today: int
    avg_response_time: float
    top_endpoints: list[dict]


class APIKeyListResponse(BaseModel):
    items: list[APIKeyResponse]
    total: int


class ScopeInfo(BaseModel):
    scope: str
    description: str


class ScopesListResponse(BaseModel):
    scopes: list[ScopeInfo]
