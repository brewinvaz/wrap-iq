import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.auth.permissions import require_superadmin
from app.models.audit_log import ActionType
from app.models.user import Role, User
from app.schemas.superadmin import (
    AuditLogListResponse,
    ImpersonationResponse,
    MetricsResponse,
    OrgCreateRequest,
    OrgDetailResponse,
    OrgListResponse,
    OrgResponse,
    OrgUpdateRequest,
    StopImpersonationResponse,
    SuperadminUserCreateRequest,
    SuperadminUserUpdateRequest,
    UserListResponse,
    UserResponse,
)
from app.services.audit_log import AuditLogService
from app.services.superadmin import SuperadminService

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


# ── Org management ───────────────────────────────────────────────────


@router.get("/orgs", response_model=OrgListResponse)
async def list_orgs(
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """List all organizations (paginated, search by name)."""
    service = SuperadminService(session)
    orgs, total = await service.list_orgs(search=search, limit=limit, offset=offset)
    return {"items": orgs, "total": total}


@router.get("/orgs/{org_id}", response_model=OrgDetailResponse)
async def get_org(
    org_id: uuid.UUID,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Get organization detail with user/work-order counts."""
    service = SuperadminService(session)
    detail = await service.get_org_detail(org_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )
    return detail


@router.post("/orgs", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
async def create_org(
    body: OrgCreateRequest,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Create an organization."""
    service = SuperadminService(session)
    org = await service.create_org(
        name=body.name,
        plan_id=body.plan_id,
        is_active=body.is_active,
        superadmin_id=admin.id,
    )
    await session.commit()
    await session.refresh(org)
    return org


@router.patch("/orgs/{org_id}", response_model=OrgResponse)
async def update_org(
    org_id: uuid.UUID,
    body: OrgUpdateRequest,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Update an organization (name, plan_id, is_active)."""
    service = SuperadminService(session)
    org = await service.update_org(
        org_id=org_id,
        superadmin_id=admin.id,
        name=body.name,
        plan_id=body.plan_id,
        is_active=body.is_active,
    )
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )
    await session.commit()
    await session.refresh(org)
    return org


# ── User management ─────────────────────────────────────────────────


@router.get("/users", response_model=UserListResponse)
async def list_users(
    organization_id: uuid.UUID | None = Query(None),
    role: Role | None = Query(None),
    is_active: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """List users across all organizations."""
    service = SuperadminService(session)
    users, total = await service.list_users(
        organization_id=organization_id,
        role=role,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )
    return {"items": users, "total": total}


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Get user detail."""
    service = SuperadminService(session)
    user = await service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: SuperadminUserUpdateRequest,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Update a user (role, is_active, is_superadmin)."""
    service = SuperadminService(session)
    user = await service.update_user(
        user_id=user_id,
        superadmin_id=admin.id,
        role=body.role,
        is_active=body.is_active,
        is_superadmin=body.is_superadmin,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    await session.commit()
    await session.refresh(user)
    return user


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_superadmin_user(
    body: SuperadminUserCreateRequest,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Create a new superadmin user (no org)."""
    service = SuperadminService(session)
    try:
        user = await service.create_superadmin_user(
            email=body.email,
            password=body.password,
            superadmin_id=admin.id,
            is_superadmin=body.is_superadmin,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    await session.commit()
    await session.refresh(user)
    return user


# ── Metrics ──────────────────────────────────────────────────────────


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Get platform-wide metrics."""
    service = SuperadminService(session)
    return await service.get_metrics()


# ── Audit logs ───────────────────────────────────────────────────────


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    organization_id: uuid.UUID | None = Query(None),
    action: ActionType | None = Query(None),
    user_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Cross-org audit logs."""
    service = AuditLogService(session)
    logs, total = await service.list_all_logs(
        organization_id=organization_id,
        action=action,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    return {"items": logs, "total": total}


# ── Impersonation ───────────────────────────────────────────────────


@router.post("/impersonate/{org_id}", response_model=ImpersonationResponse)
async def start_impersonation(
    org_id: uuid.UUID,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Start impersonating an organization."""
    service = SuperadminService(session)
    result = await service.start_impersonation(admin, org_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive",
        )
    await session.commit()
    return result


@router.post("/stop-impersonation", response_model=StopImpersonationResponse)
async def stop_impersonation(
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Stop impersonation and return to normal superadmin token."""
    service = SuperadminService(session)
    result = await service.stop_impersonation(admin)
    await session.commit()
    return result
