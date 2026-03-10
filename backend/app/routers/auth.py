from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.auth.dependencies import get_session
from app.middleware.rate_limit import limiter
from app.schemas.auth import (
    LoginRequest,
    MagicLinkRequest,
    MagicLinkVerify,
    MessageResponse,
    RegisterRequest,
    TokenRefreshRequest,
    TokenResponse,
)
from app.services.auth import AuthService
from app.services.email import send_magic_link_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
@limiter.limit("10/minute")
async def register(
    request: Request,
    response: Response,
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
):
    service = AuthService(session)
    try:
        tokens = await service.register(
            email=body.email, password=body.password, org_name=body.org_name
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return tokens


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    service = AuthService(session)
    try:
        tokens = await service.login(email=body.email, password=body.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return tokens


@router.post("/magic-link/request", response_model=MessageResponse)
@limiter.limit("10/minute")
async def request_magic_link(
    request: Request,
    response: Response,
    body: MagicLinkRequest,
    session: AsyncSession = Depends(get_session),
):
    service = AuthService(session)
    token = await service.request_magic_link(email=body.email)
    if token:
        await send_magic_link_email(body.email, token)
    return {"message": "If the email exists, a magic link has been sent"}


@router.post("/magic-link/verify", response_model=TokenResponse)
@limiter.limit("10/minute")
async def verify_magic_link(
    request: Request,
    response: Response,
    body: MagicLinkVerify,
    session: AsyncSession = Depends(get_session),
):
    service = AuthService(session)
    try:
        tokens = await service.verify_magic_link(token=body.token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired magic link",
        )
    return tokens


@router.post("/token/refresh", response_model=TokenResponse)
async def refresh_token(
    body: TokenRefreshRequest, session: AsyncSession = Depends(get_session)
):
    service = AuthService(session)
    try:
        tokens = await service.refresh(refresh_token_str=body.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return tokens


@router.post("/logout", response_model=MessageResponse)
async def logout(
    body: TokenRefreshRequest, session: AsyncSession = Depends(get_session)
):
    service = AuthService(session)
    await service.logout(refresh_token_str=body.refresh_token)
    return {"message": "Logged out"}
