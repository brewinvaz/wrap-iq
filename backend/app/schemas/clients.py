import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.client import ClientType


class ClientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    client_type: ClientType = ClientType.personal
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    tags: list[str] = []
    referral_source: str | None = None
    notes: str | None = None
    parent_id: uuid.UUID | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Name must not be empty or whitespace-only")
        return stripped


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    client_type: ClientType | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    tags: list[str] | None = None
    referral_source: str | None = None
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str | None) -> str | None:
        if v is None:
            return v
        stripped = v.strip()
        if not stripped:
            raise ValueError("Name must not be empty or whitespace-only")
        return stripped


class ClientResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    client_type: ClientType
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    tags: list[str] = []
    referral_source: str | None = None
    notes: str | None = None
    is_active: bool
    parent_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class ClientDetailResponse(ClientResponse):
    sub_clients: list[ClientResponse] = []
    project_count: int = 0
    total_revenue: int = 0


class ClientListItemResponse(ClientResponse):
    project_count: int = 0
    total_revenue: int = 0


class ClientListResponse(BaseModel):
    items: list[ClientListItemResponse]
    total: int


class ClientAggregateReport(BaseModel):
    client_id: uuid.UUID
    client_name: str
    total_projects: int
    total_revenue: int
    sub_client_count: int
    sub_client_projects: int
    sub_client_revenue: int
    combined_projects: int
    combined_revenue: int
