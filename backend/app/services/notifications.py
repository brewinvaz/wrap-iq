import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType


class NotificationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.INFO,
    ) -> Notification:
        notification = Notification(
            id=uuid.uuid4(),
            organization_id=organization_id,
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
        )
        self.session.add(notification)
        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Notification], int]:
        query = select(Notification).where(
            Notification.user_id == user_id,
            Notification.organization_id == organization_id,
        )
        count_query = select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.organization_id == organization_id,
        )

        if unread_only:
            query = query.where(Notification.is_read.is_(False))
            count_query = count_query.where(Notification.is_read.is_(False))

        query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)

        result = await self.session.execute(query)
        notifications = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar()

        return notifications, total

    async def mark_as_read(
        self, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> Notification | None:
        result = await self.session.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return None

        notification.is_read = True
        notification.read_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(notification)
        return notification

    async def mark_all_as_read(
        self, user_id: uuid.UUID, organization_id: uuid.UUID
    ) -> int:
        result = await self.session.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.organization_id == organization_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=datetime.now(UTC))
        )
        await self.session.commit()
        return result.rowcount

    async def get_unread_count(
        self, user_id: uuid.UUID, organization_id: uuid.UUID
    ) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.organization_id == organization_id,
                Notification.is_read.is_(False),
            )
        )
        return result.scalar()

    async def delete(
        self, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        result = await self.session.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return False

        await self.session.delete(notification)
        await self.session.commit()
        return True
