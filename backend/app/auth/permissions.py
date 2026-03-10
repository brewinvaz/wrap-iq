import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.user import Role, User


def require_role(*roles: Role) -> Callable:
    """FastAPI dependency that checks user has one of the specified roles."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.is_superadmin:
            return user
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return checker


require_admin = require_role(Role.ADMIN)


async def require_org_member(
    user: User = Depends(get_current_user),
) -> User:
    """Ensures user belongs to an organization. Superadmins bypass."""
    if user.is_superadmin:
        return user
    if user.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of any organization",
        )
    return user


async def require_superadmin(
    user: User = Depends(get_current_user),
) -> User:
    """Ensures user is a superadmin. Returns 403 otherwise."""
    if not user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required",
        )
    return user


def require_same_org(target_org_id: uuid.UUID) -> Callable:
    """Ensures user belongs to the specified organization."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.is_superadmin:
            return user
        if user.organization_id != target_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this organization",
            )
        return user

    return checker
