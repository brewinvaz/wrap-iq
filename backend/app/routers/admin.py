import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.auth.organization import org_filter
from app.auth.passwords import hash_password
from app.auth.permissions import require_admin
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.admin import (
    InviteUserRequest,
    InviteUserResponse,
    ToggleActiveRequest,
    UpdateRoleRequest,
    UserListResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _build_full_name(profile: UserProfile | None) -> str | None:
    """Build full name from profile first/last name fields."""
    if not profile:
        return None
    parts = [p for p in (profile.first_name, profile.last_name) if p]
    return " ".join(parts) if parts else None


@router.get("/users", response_model=list[UserListResponse])
async def list_users(
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List all users in the admin's organization."""
    query = select(User, UserProfile).outerjoin(
        UserProfile, User.id == UserProfile.user_id
    )
    query = org_filter(query, admin)
    result = await session.execute(query)
    rows = result.all()
    return [
        UserListResponse(
            id=user.id,
            email=user.email,
            full_name=_build_full_name(profile),
            role=user.role,
            organization_id=user.organization_id,
            is_active=user.is_active,
            is_superadmin=user.is_superadmin,
            created_at=user.created_at,
        )
        for user, profile in rows
    ]


@router.patch("/users/{user_id}/role", response_model=UserListResponse)
async def update_user_role(
    user_id: uuid.UUID,
    body: UpdateRoleRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update a user's role. Admin only."""
    query = select(User).where(User.id == user_id)
    query = org_filter(query, admin)
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role",
        )

    user.role = body.role
    await session.commit()
    await session.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Deactivate a user. Admin only."""
    query = select(User).where(User.id == user_id)
    query = org_filter(query, admin)
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself",
        )

    user.is_active = False
    await session.commit()


@router.post(
    "/users/invite",
    response_model=InviteUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite_user(
    body: InviteUserRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Invite a new user to the admin's organization. Admin only."""
    existing = await session.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    temp_password = secrets.token_urlsafe(16)
    user = User(
        id=uuid.uuid4(),
        organization_id=admin.organization_id,
        email=body.email,
        password_hash=hash_password(temp_password),
        role=body.role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return InviteUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        organization_id=user.organization_id,
        is_active=user.is_active,
        is_superadmin=user.is_superadmin,
        created_at=user.created_at,
        updated_at=user.updated_at,
        temp_password=temp_password,
    )


@router.patch("/users/{user_id}/active", response_model=UserListResponse)
async def toggle_user_active(
    user_id: uuid.UUID,
    body: ToggleActiveRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Toggle a user's active status. Admin only."""
    query = select(User).where(User.id == user_id)
    query = org_filter(query, admin)
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own active status",
        )

    user.is_active = body.is_active
    await session.commit()
    await session.refresh(user)
    return user
