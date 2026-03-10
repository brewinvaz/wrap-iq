import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.vin import VehicleInfo, VinDecodeRequest
from app.services.vin import decode_vin

router = APIRouter(prefix="/api/vin", tags=["vin"])


@router.get("/{vin}", response_model=VehicleInfo)
async def decode_vin_endpoint(
    vin: str,
    user: User = Depends(get_current_user),
):
    """Decode a VIN and return vehicle information."""
    # Validate VIN format using schema
    try:
        request = VinDecodeRequest(vin=vin)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    try:
        return await decode_vin(request.vin)
    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="NHTSA API returned an error",
        )
    except (httpx.TimeoutException, httpx.ConnectError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="NHTSA API is unavailable",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
