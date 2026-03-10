import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.client_portal import (
    PortalProjectDetail,
    PortalProjectSummary,
)
from app.services.notifications import NotificationService


class ClientPortalService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_projects(
        self, user_id: uuid.UUID, org_id: uuid.UUID
    ) -> list[PortalProjectSummary]:
        """Return work order summaries for the client's organization.

        TODO: Query WorkOrder model once it exists. Currently returns an empty
        list because the WorkOrder data model has not been created yet.
        """
        return []

    async def get_project_detail(
        self, project_id: uuid.UUID, user_id: uuid.UUID, org_id: uuid.UUID
    ) -> PortalProjectDetail | None:
        """Return full project info including status timeline.

        TODO: Query WorkOrder model once it exists. Currently returns None
        because the WorkOrder data model has not been created yet.
        """
        return None

    async def get_notifications(
        self, user_id: uuid.UUID, org_id: uuid.UUID
    ) -> tuple[list, int]:
        """Delegate to NotificationService for the given user."""
        svc = NotificationService(self.session)
        return await svc.list_for_user(user_id=user_id, organization_id=org_id)

    async def get_unread_count(self, user_id: uuid.UUID, org_id: uuid.UUID) -> int:
        """Delegate to NotificationService for unread count."""
        svc = NotificationService(self.session)
        return await svc.get_unread_count(user_id=user_id, organization_id=org_id)
