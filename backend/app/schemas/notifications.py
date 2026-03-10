import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.notification import NotificationType


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    title: str
    message: str
    notification_type: NotificationType = NotificationType.INFO


class NotificationUpdate(BaseModel):
    is_read: bool | None = None


class NotificationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    notification_type: NotificationType
    is_read: bool
    read_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int


class UnreadCountResponse(BaseModel):
    count: int
