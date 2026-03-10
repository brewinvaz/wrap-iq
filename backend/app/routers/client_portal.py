import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import Response

from app.auth.dependencies import get_session
from app.auth.permissions import require_role
from app.middleware.rate_limit import limiter
from app.models.user import Role, User
from app.schemas.auth import MagicLinkRequest, MessageResponse
from app.schemas.client_portal import (
    PortalProjectDetail,
    PortalProjectListResponse,
)
from app.schemas.notifications import NotificationListResponse, UnreadCountResponse
from app.services.auth import AuthService
from app.services.client_portal import ClientPortalService
from app.services.email import send_magic_link_email

require_client = require_role(Role.CLIENT)

router = APIRouter(prefix="/api/portal", tags=["client-portal"])


@router.get("/projects", response_model=PortalProjectListResponse)
async def list_projects(
    user: User = Depends(require_client),
    session: AsyncSession = Depends(get_session),
):
    service = ClientPortalService(session)
    items = await service.get_projects(user_id=user.id, org_id=user.organization_id)
    return PortalProjectListResponse(items=items)


@router.get("/projects/{project_id}", response_model=PortalProjectDetail)
async def get_project(
    project_id: uuid.UUID,
    user: User = Depends(require_client),
    session: AsyncSession = Depends(get_session),
):
    service = ClientPortalService(session)
    detail = await service.get_project_detail(
        project_id=project_id, user_id=user.id, org_id=user.organization_id
    )
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return detail


@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    user: User = Depends(require_client),
    session: AsyncSession = Depends(get_session),
):
    service = ClientPortalService(session)
    notifications, total = await service.get_notifications(
        user_id=user.id, org_id=user.organization_id
    )
    return NotificationListResponse(items=notifications, total=total)


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    user: User = Depends(require_client),
    session: AsyncSession = Depends(get_session),
):
    service = ClientPortalService(session)
    count = await service.get_unread_count(user_id=user.id, org_id=user.organization_id)
    return UnreadCountResponse(count=count)


@router.post("/magic-link/request", response_model=MessageResponse)
@limiter.limit("5/minute")
async def request_portal_magic_link(
    request: Request,
    response: Response,
    body: MagicLinkRequest,
    session: AsyncSession = Depends(get_session),
):
    """Portal-specific alias for magic link requests."""
    service = AuthService(session)
    token = await service.request_magic_link(email=body.email)
    if token:
        await send_magic_link_email(body.email, token)
    return MessageResponse(message="If the email exists, a magic link has been sent")
