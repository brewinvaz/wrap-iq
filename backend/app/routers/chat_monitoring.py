import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.auth.dependencies import get_current_user, get_session
from app.config import settings
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.chat_monitoring import (
    ApplyUpdateRequest,
    ApplyUpdateResponse,
    ChatAnalysisResponse,
    ChatMessage,
)
from app.services.chat_monitoring import ChatMonitoringService

logger = logging.getLogger("wrapiq")

router = APIRouter(prefix="/api/ai/chat", tags=["chat-monitoring"])


@router.post("/analyze", response_model=ChatAnalysisResponse)
@limiter.limit("10/minute")
async def analyze_chat_message(
    request: Request,
    response: Response,
    data: ChatMessage,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat monitoring is not configured",
        )

    try:
        service = ChatMonitoringService()
        return await service.analyze_message(data, user, session)
    except Exception as exc:
        logger.exception("Chat monitoring request failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred processing your request",
        ) from exc


@router.post("/apply", response_model=ApplyUpdateResponse)
@limiter.limit("10/minute")
async def apply_chat_update(
    request: Request,
    response: Response,
    data: ApplyUpdateRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat monitoring is not configured",
        )

    try:
        service = ChatMonitoringService()
        return await service.apply_update(data, user, session)
    except Exception as exc:
        logger.exception("Chat monitoring request failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred processing your request",
        ) from exc
