from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from starlette.responses import Response

from app.auth.dependencies import get_current_user
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.vehicle_detection import VehicleDetectionResponse
from app.services.vehicle_detection import detect_vehicle_from_image

router = APIRouter(prefix="/api/vehicles", tags=["vehicle-detection"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ACCEPTED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/detect", response_model=VehicleDetectionResponse)
@limiter.limit("10/minute")
async def detect_vehicle(
    request: Request,
    response: Response,
    file: UploadFile,
    user: User = Depends(get_current_user),
):
    """Upload a vehicle photo to auto-detect year, make, model."""
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
        return await detect_vehicle_from_image(image_data, file.content_type)
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
