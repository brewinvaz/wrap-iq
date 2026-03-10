import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.auth.permissions import require_admin
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.notifications import (
    NotificationCreate,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notifications import NotificationService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = NotificationService(session)
    notifications, total = await service.list_for_user(
        user_id=user.id,
        organization_id=user.organization_id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )
    return NotificationListResponse(items=notifications, total=total)


@router.post(
    "", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED
)
async def create_notification(
    body: NotificationCreate,
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = NotificationService(session)
    notification = await service.create(
        organization_id=user.organization_id,
        user_id=body.user_id,
        title=body.title,
        message=body.message,
        notification_type=body.notification_type,
    )
    return notification


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = NotificationService(session)
    count = await service.get_unread_count(user.id, user.organization_id)
    return UnreadCountResponse(count=count)


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = NotificationService(session)
    notification = await service.mark_as_read(notification_id, user.id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.post("/mark-all-read", response_model=MessageResponse)
async def mark_all_as_read(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = NotificationService(session)
    count = await service.mark_all_as_read(user.id, user.organization_id)
    return MessageResponse(message=f"Marked {count} notifications as read")


@router.delete("/{notification_id}", response_model=MessageResponse)
async def delete_notification(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = NotificationService(session)
    deleted = await service.delete(notification_id, user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return MessageResponse(message="Notification deleted")
