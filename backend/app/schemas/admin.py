import uuid

from pydantic import BaseModel

from app.models.user import Role


class UserListResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    organization_id: uuid.UUID | None
    is_active: bool
    is_superadmin: bool

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    role: Role
