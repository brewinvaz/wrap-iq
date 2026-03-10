import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.discrepancy_detection import DiscrepancyCheckResponse
from app.services.discrepancy_detection import detect_discrepancies

router = APIRouter(prefix="/api/vehicles", tags=["discrepancy-detection"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ACCEPTED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/discrepancy-check", response_model=DiscrepancyCheckResponse)
@limiter.limit("10/minute")
async def check_discrepancy(
    request: Request,
    file: UploadFile,
    vehicle_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if file.content_type not in ACCEPTED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid file type '{file.content_type}'. "
                f"Accepted types: {', '.join(sorted(ACCEPTED_TYPES))}"
            ),
        )

    image_data = await file.read()

    if len(image_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10 MB.",
        )

    try:
        return await detect_discrepancies(
            vehicle_id=vehicle_id,
            organization_id=user.organization_id,
            image_data=image_data,
            content_type=file.content_type,
            session=session,
        )
    except LookupError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle {vehicle_id} not found",
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service returned an error. Please try again.",
        )
