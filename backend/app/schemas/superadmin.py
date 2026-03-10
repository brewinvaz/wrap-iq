import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.audit_log import ActionType
from app.models.user import Role

# ── Org schemas ──────────────────────────────────────────────────────


class OrgListParams(BaseModel):
    search: str | None = None
    limit: int = 50
    offset: int = 0


class OrgCreateRequest(BaseModel):
    name: str
    plan_id: uuid.UUID
    is_active: bool = True


class OrgUpdateRequest(BaseModel):
    name: str | None = None
    plan_id: uuid.UUID | None = None
    is_active: bool | None = None


class OrgResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrgDetailResponse(OrgResponse):
    user_count: int
    work_order_count: int


class OrgListResponse(BaseModel):
    items: list[OrgResponse]
    total: int


# ── User schemas ─────────────────────────────────────────────────────


class UserListParams(BaseModel):
    organization_id: uuid.UUID | None = None
    role: Role | None = None
    is_active: bool | None = None
    limit: int = 50
    offset: int = 0


class SuperadminUserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    is_superadmin: bool = True


class SuperadminUserUpdateRequest(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    is_superadmin: bool | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    organization_id: uuid.UUID | None
    is_active: bool
    is_superadmin: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int


# ── Metrics schemas ──────────────────────────────────────────────────


class PlanCount(BaseModel):
    plan_name: str
    count: int


class RecentSignup(BaseModel):
    org_name: str
    created_at: datetime


class MetricsResponse(BaseModel):
    total_organizations: int
    total_users: int
    total_work_orders: int
    orgs_by_plan: list[PlanCount]
    recent_signups: list[RecentSignup]


# ── Audit log schemas ───────────────────────────────────────────────


class AuditLogParams(BaseModel):
    organization_id: uuid.UUID | None = None
    action: ActionType | None = None
    user_id: uuid.UUID | None = None
    limit: int = 50
    offset: int = 0


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID | None
    action: ActionType
    resource_type: str
    resource_id: uuid.UUID | None
    details: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int


# ── Impersonation schemas ───────────────────────────────────────────


class ImpersonationResponse(BaseModel):
    access_token: str
    organization_id: uuid.UUID
    impersonating: bool = True


class StopImpersonationResponse(BaseModel):
    access_token: str
    impersonating: bool = False
