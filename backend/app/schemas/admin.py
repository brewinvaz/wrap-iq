import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import Role


class UserListResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None = None
    role: Role
    organization_id: uuid.UUID | None
    is_active: bool
    is_superadmin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserDetailResponse(UserListResponse):
    updated_at: datetime


class InviteUserResponse(UserDetailResponse):
    """Response for user invitation that includes the temporary password."""

    temp_password: str


class UpdateRoleRequest(BaseModel):
    role: Role


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: Role


class ToggleActiveRequest(BaseModel):
    is_active: bool
