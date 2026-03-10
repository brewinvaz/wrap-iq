import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import ActionType, AuditLog


class AuditLogService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_log(
        self,
        organization_id: uuid.UUID,
        action: ActionType,
        resource_type: str,
        resource_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        details: dict | None = None,
    ) -> AuditLog:
        log = AuditLog(
            id=uuid.uuid4(),
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
        )
        self.session.add(log)
        await self.session.flush()
        return log

    async def list_logs(
        self,
        organization_id: uuid.UUID,
        action: ActionType | None = None,
        resource_type: str | None = None,
        resource_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        query = select(AuditLog).where(AuditLog.organization_id == organization_id)
        count_query = (
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.organization_id == organization_id)
        )

        if action is not None:
            query = query.where(AuditLog.action == action)
            count_query = count_query.where(AuditLog.action == action)

        if resource_type is not None:
            query = query.where(AuditLog.resource_type == resource_type)
            count_query = count_query.where(AuditLog.resource_type == resource_type)

        if resource_id is not None:
            query = query.where(AuditLog.resource_id == resource_id)
            count_query = count_query.where(AuditLog.resource_id == resource_id)

        if user_id is not None:
            query = query.where(AuditLog.user_id == user_id)
            count_query = count_query.where(AuditLog.user_id == user_id)

        query = query.order_by(AuditLog.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        logs = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()

        return logs, total
