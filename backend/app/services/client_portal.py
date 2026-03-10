import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.kanban_stage import SystemStatus
from app.models.work_order import WorkOrder
from app.schemas.client_portal import (
    PortalProjectDetail,
    PortalProjectSummary,
    StatusTimelineEntry,
)
from app.services.notifications import NotificationService

# Ordered phases used to build the status timeline.
_PHASES = [
    ("lead", "Lead / Quote"),
    ("design", "Design"),
    ("production", "Production"),
    ("install", "Installation"),
    ("completed", "Completed"),
]


def _vehicle_summary(wo: WorkOrder) -> str:
    """Build a human-readable vehicle summary from work order vehicles."""
    parts: list[str] = []
    for wov in wo.work_order_vehicles:
        v = wov.vehicle
        if v is None:
            continue
        chunks = [str(v.year)] if v.year else []
        if v.make:
            chunks.append(v.make)
        if v.model:
            chunks.append(v.model)
        parts.append(" ".join(chunks) if chunks else "Unknown vehicle")
    return ", ".join(parts) if parts else "No vehicle"


def _progress_pct(wo: WorkOrder) -> int:
    """Compute rough progress percentage from the kanban stage system_status."""
    if wo.completion_date is not None:
        return 100
    status = wo.status
    if status is None or status.system_status is None:
        return 0
    mapping = {
        SystemStatus.LEAD: 10,
        SystemStatus.IN_PROGRESS: 50,
        SystemStatus.COMPLETED: 100,
        SystemStatus.CANCELLED: 0,
    }
    return mapping.get(status.system_status, 0)


def _build_timeline(wo: WorkOrder) -> list[StatusTimelineEntry]:
    """Build a status timeline from the work order state."""
    timestamps: dict[str, str] = wo.status_timestamps or {}
    has_completion = wo.completion_date is not None

    # Determine which phases are completed based on available data.
    phase_completed: dict[str, bool] = {
        "lead": True,  # Always completed if work order exists.
        "design": wo.design_details is not None,
        "production": wo.production_details is not None,
        "install": wo.install_details is not None,
        "completed": has_completion,
    }

    entries: list[StatusTimelineEntry] = []
    for phase_key, label in _PHASES:
        completed = phase_completed.get(phase_key, False)

        # Try to find a timestamp for this phase from status_timestamps.
        completed_at: datetime | None = None
        if phase_key == "completed" and wo.completion_date:
            completed_at = wo.completion_date
        elif timestamps:
            # status_timestamps maps status_id -> iso timestamp.
            # We don't have a direct phase->status_id mapping, so we skip
            # precise timestamps here; the completed flag is still useful.
            pass

        entries.append(
            StatusTimelineEntry(
                phase=phase_key,
                label=label,
                completed=completed,
                completed_at=completed_at,
            )
        )
    return entries


def _to_summary(wo: WorkOrder) -> PortalProjectSummary:
    return PortalProjectSummary(
        id=wo.id,
        job_number=wo.job_number,
        status=wo.status.name if wo.status else "Unknown",
        vehicle_summary=_vehicle_summary(wo),
        date_in=wo.date_in,
        estimated_completion=wo.estimated_completion_date,
        progress_pct=_progress_pct(wo),
    )


def _to_detail(wo: WorkOrder) -> PortalProjectDetail:
    return PortalProjectDetail(
        id=wo.id,
        job_number=wo.job_number,
        status=wo.status.name if wo.status else "Unknown",
        vehicle_summary=_vehicle_summary(wo),
        date_in=wo.date_in,
        estimated_completion=wo.estimated_completion_date,
        progress_pct=_progress_pct(wo),
        status_timeline=_build_timeline(wo),
        notes=wo.internal_notes,
    )


class ClientPortalService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_projects(
        self, user_id: uuid.UUID, org_id: uuid.UUID
    ) -> list[PortalProjectSummary]:
        """Return work order summaries for the client's organization."""
        result = await self.session.execute(
            select(WorkOrder)
            .where(WorkOrder.organization_id == org_id)
            .order_by(WorkOrder.date_in.desc())
        )
        work_orders = list(result.scalars().all())
        return [_to_summary(wo) for wo in work_orders]

    async def get_project_detail(
        self, project_id: uuid.UUID, user_id: uuid.UUID, org_id: uuid.UUID
    ) -> PortalProjectDetail | None:
        """Return full project info including status timeline."""
        result = await self.session.execute(
            select(WorkOrder).where(
                WorkOrder.id == project_id,
                WorkOrder.organization_id == org_id,
            )
        )
        wo = result.scalar_one_or_none()
        if wo is None:
            return None
        return _to_detail(wo)

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
