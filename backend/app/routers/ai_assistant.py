from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.auth.dependencies import get_current_user, get_session
from app.config import settings
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.ai_assistant import QueryRequest, QueryResponse
from app.services.ai_assistant import AIAssistantService

router = APIRouter(prefix="/api/ai", tags=["ai-assistant"])


@router.post("/query", response_model=QueryResponse)
@limiter.limit("10/minute")
async def query_assistant(
    request: Request,
    response: Response,
    data: QueryRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assistant is not configured",
        )

    try:
        service = AIAssistantService()
        return await service.answer_question(data.question, user, session)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                str(exc)
                if settings.debug
                else "An error occurred processing your request"
            ),
        ) from exc
