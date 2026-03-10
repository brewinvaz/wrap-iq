import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import Role


class UserListResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    organization_id: uuid.UUID | None
    is_active: bool
    is_superadmin: bool

    model_config = {"from_attributes": True}


class UserDetailResponse(UserListResponse):
    created_at: datetime
    updated_at: datetime


class UpdateRoleRequest(BaseModel):
    role: Role


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: Role


class ToggleActiveRequest(BaseModel):
    is_active: bool
