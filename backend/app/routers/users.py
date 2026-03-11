from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.users import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    full_name = None
    if profile:
        parts = [
            profile.first_name or "",
            profile.last_name or "",
        ]
        joined = " ".join(p for p in parts if p)
        if joined:
            full_name = joined

    response = UserResponse.model_validate(user)
    response.full_name = full_name
    return response
