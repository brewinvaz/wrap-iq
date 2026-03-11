import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.config import settings
from app.schemas.onboarding import (
    OnboardingOrgInfo,
    OnboardingResult,
    OnboardingSubmission,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services.email import send_magic_link_email
from app.services.onboarding import OnboardingService
from app.services.r2 import generate_object_key, generate_upload_url, validate_file_keys
from app.services.vin import decode_vin

logger = logging.getLogger("wrapiq")

router = APIRouter(prefix="/api/portal/onboarding", tags=["onboarding"])


async def _get_valid_invite(token: str, session: AsyncSession):
    """Helper to validate invite token and return invite or raise."""
    service = OnboardingService(session)
    invite = await service.validate_token(token)
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invite link is invalid, expired, or already used",
        )
    return invite


@router.get("/{token}", response_model=OnboardingOrgInfo)
async def validate_invite(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Validate invite token and return org info for form branding."""
    invite = await _get_valid_invite(token, session)
    service = OnboardingService(session)
    org = await service.get_org_for_invite(invite)
    return {"organization_name": org.name}


@router.post("/{token}/vin/{vin}")
async def decode_vin_endpoint(
    token: str,
    vin: str,
    session: AsyncSession = Depends(get_session),
):
    """Decode a VIN for the onboarding form (no JWT required)."""
    await _get_valid_invite(token, session)
    try:
        info = await decode_vin(vin)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to decode VIN %s", vin)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred",
        ) from e
    return info


@router.post("/{token}/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    token: str,
    body: UploadUrlRequest,
    session: AsyncSession = Depends(get_session),
):
    """Generate a presigned R2 upload URL for the client."""
    if not settings.r2_account_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File upload is not configured (R2 storage unavailable)",
        )
    invite = await _get_valid_invite(token, session)
    try:
        r2_key = generate_object_key(invite.organization_id, body.filename)
        url = generate_upload_url(r2_key, body.content_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return {"upload_url": url, "r2_key": r2_key}


@router.post("/{token}/submit", response_model=OnboardingResult)
async def submit_onboarding(
    token: str,
    body: OnboardingSubmission,
    session: AsyncSession = Depends(get_session),
):
    """Submit the onboarding form. Creates User, Vehicle, WorkOrder."""
    invite = await _get_valid_invite(token, session)
    service = OnboardingService(session)

    # Validate file keys belong to the invite's organization before processing
    file_key_dicts = [fk.model_dump() for fk in body.file_keys]
    try:
        validate_file_keys(invite.organization_id, file_key_dicts)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    try:
        result = await service.submit_onboarding(
            invite=invite,
            first_name=body.first_name,
            last_name=body.last_name,
            phone=body.phone,
            company_name=body.company_name,
            address=body.address,
            vehicle_data=body.vehicle.model_dump(exclude_none=True),
            job_type=body.job_type,
            project_description=body.project_description,
            referral_source=body.referral_source,
            file_keys=file_key_dicts,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    await session.commit()

    # Send magic link for portal access
    from app.services.auth import AuthService

    auth_service = AuthService(session)
    magic_token = await auth_service.request_magic_link(invite.email)
    if magic_token:
        await send_magic_link_email(invite.email, magic_token)

    return {
        "message": "Onboarding complete. Check your email for portal access.",
        "work_order_id": result["work_order_id"],
        "job_number": result["job_number"],
    }
