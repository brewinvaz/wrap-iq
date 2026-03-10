import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.auth.permissions import require_admin
from app.models.user import User
from app.schemas.api_key import (
    AVAILABLE_SCOPES,
    APIKeyCreate,
    APIKeyCreatedResponse,
    APIKeyListResponse,
    APIKeyResponse,
    APIKeyRotateResponse,
    APIKeyUsageStats,
    ScopeInfo,
    ScopesListResponse,
)
from app.schemas.auth import MessageResponse
from app.services.api_key_service import APIKeyService

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])

SCOPE_DESCRIPTIONS = {
    "projects:read": "Read access to projects and work orders",
    "projects:write": "Create and update projects and work orders",
    "clients:read": "Read access to client information",
    "clients:write": "Create and update client records",
    "calendar:read": "Read access to calendar and scheduling",
    "calendar:write": "Create and update calendar events",
    "team:read": "Read access to team member information",
    "team:write": "Manage team members and roles",
    "billing:read": "Read access to billing and invoicing data",
    "webhooks:manage": "Create and manage webhook subscriptions",
}


@router.get("/scopes", response_model=ScopesListResponse)
async def list_scopes(
    user: User = Depends(get_current_user),
):
    scopes = [
        ScopeInfo(scope=s, description=SCOPE_DESCRIPTIONS.get(s, s))
        for s in AVAILABLE_SCOPES
    ]
    return ScopesListResponse(scopes=scopes)


@router.get("", response_model=APIKeyListResponse)
async def list_api_keys(
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = APIKeyService(session)
    keys, total = await service.list_api_keys(
        organization_id=user.organization_id,
    )
    items = []
    for key in keys:
        usage_count = await service.get_usage_count(key.id)
        items.append(
            APIKeyResponse(
                id=key.id,
                name=key.name,
                key_prefix=key.key_prefix,
                scopes=key.scopes,
                rate_limit_per_minute=key.rate_limit_per_minute,
                rate_limit_per_day=key.rate_limit_per_day,
                is_active=key.is_active,
                last_used_at=key.last_used_at,
                expires_at=key.expires_at,
                created_by=key.created_by,
                created_at=key.created_at,
                revoked_at=key.revoked_at,
                usage_count=usage_count,
            )
        )
    return APIKeyListResponse(items=items, total=total)


@router.post(
    "", response_model=APIKeyCreatedResponse, status_code=status.HTTP_201_CREATED
)
async def create_api_key(
    body: APIKeyCreate,
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    # Validate scopes
    invalid_scopes = [s for s in body.scopes if s not in AVAILABLE_SCOPES]
    if invalid_scopes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid scopes: {', '.join(invalid_scopes)}",
        )

    service = APIKeyService(session)
    api_key, full_key = await service.generate_api_key(
        organization_id=user.organization_id,
        created_by=user.id,
        name=body.name,
        scopes=body.scopes,
        rate_limit_per_minute=body.rate_limit_per_minute,
        rate_limit_per_day=body.rate_limit_per_day,
        expires_at=body.expires_at,
    )
    return APIKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes,
        rate_limit_per_minute=api_key.rate_limit_per_minute,
        rate_limit_per_day=api_key.rate_limit_per_day,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        created_by=api_key.created_by,
        created_at=api_key.created_at,
        revoked_at=api_key.revoked_at,
        usage_count=0,
        full_key=full_key,
    )


@router.get("/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: uuid.UUID,
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = APIKeyService(session)
    api_key = await service.get_api_key(key_id, user.organization_id)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    usage_count = await service.get_usage_count(api_key.id)
    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes,
        rate_limit_per_minute=api_key.rate_limit_per_minute,
        rate_limit_per_day=api_key.rate_limit_per_day,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        created_by=api_key.created_by,
        created_at=api_key.created_at,
        revoked_at=api_key.revoked_at,
        usage_count=usage_count,
    )


@router.delete("/{key_id}", response_model=MessageResponse)
async def revoke_api_key(
    key_id: uuid.UUID,
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = APIKeyService(session)
    api_key = await service.revoke_api_key(key_id, user.organization_id)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    return MessageResponse(message="API key revoked")


@router.post("/{key_id}/rotate", response_model=APIKeyRotateResponse)
async def rotate_api_key(
    key_id: uuid.UUID,
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = APIKeyService(session)
    result = await service.rotate_api_key(key_id, user.organization_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    new_key, raw_key = result
    return APIKeyRotateResponse(
        id=new_key.id,
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        scopes=new_key.scopes,
        rate_limit_per_minute=new_key.rate_limit_per_minute,
        rate_limit_per_day=new_key.rate_limit_per_day,
        is_active=new_key.is_active,
        last_used_at=new_key.last_used_at,
        expires_at=new_key.expires_at,
        created_by=new_key.created_by,
        created_at=new_key.created_at,
        revoked_at=new_key.revoked_at,
        usage_count=0,
        full_key=raw_key,
    )


@router.get("/{key_id}/usage", response_model=APIKeyUsageStats)
async def get_usage_stats(
    key_id: uuid.UUID,
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = APIKeyService(session)
    api_key = await service.get_api_key(key_id, user.organization_id)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    stats = await service.get_usage_stats(key_id)
    return APIKeyUsageStats(**stats)
