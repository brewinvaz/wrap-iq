from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.auth.permissions import require_admin
from app.models.user import User
from app.schemas.onboarding import (
    ClientInviteListResponse,
    ClientInviteRequest,
    ClientInviteResponse,
)
from app.services.email import send_onboarding_invite_email
from app.services.onboarding import OnboardingService

router = APIRouter(prefix="/api/admin/client-invites", tags=["admin"])


@router.post("", response_model=ClientInviteResponse, status_code=201)
async def create_client_invite(
    body: ClientInviteRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Send an onboarding invite to a client."""
    service = OnboardingService(session)
    invite = await service.create_invite(
        organization_id=admin.organization_id,
        email=body.email,
        invited_by=admin.id,
    )
    await session.commit()
    await session.refresh(invite)

    await send_onboarding_invite_email(
        to_email=invite.email,
        token=invite.token,
        org_name=admin.organization.name,
    )

    return invite


@router.get("", response_model=ClientInviteListResponse)
async def list_client_invites(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List client invites for the admin's organization."""
    service = OnboardingService(session)
    invites, total = await service.list_invites(
        organization_id=admin.organization_id,
        limit=limit,
        offset=offset,
    )
    return {"items": invites, "total": total}
