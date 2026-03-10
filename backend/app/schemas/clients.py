import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.client import ClientType


class ClientCreate(BaseModel):
    name: str
    client_type: ClientType = ClientType.PERSONAL
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    tags: list[str] = []
    referral_source: str | None = None
    notes: str | None = None
    parent_id: uuid.UUID | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    client_type: ClientType | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    tags: list[str] | None = None
    referral_source: str | None = None
    notes: str | None = None
    is_active: bool | None = None


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


class ClientListResponse(BaseModel):
    items: list[ClientResponse]
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
