from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.notification import Notification
from app.models.work_order import WorkOrder

router = APIRouter(prefix="/api/sidebar", tags=["sidebar"])


class BadgeCountsResponse(BaseModel):
    work_orders: int
    unread_notifications: int
    design_queue: int


@router.get("/badges", response_model=BadgeCountsResponse)
async def get_badge_counts(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return sidebar badge counts for the current user's organization."""
    org_id = user.organization_id

    # Active work orders: exclude COMPLETED and CANCELLED stages
    completed_stages = select(KanbanStage.id).where(
        KanbanStage.organization_id == org_id,
        KanbanStage.system_status.in_([SystemStatus.COMPLETED, SystemStatus.CANCELLED]),
    )
    wo_result = await session.execute(
        select(func.count(WorkOrder.id)).where(
            WorkOrder.organization_id == org_id,
            WorkOrder.status_id.not_in(completed_stages),
        )
    )
    work_orders_count = wo_result.scalar() or 0

    # Unread notifications for the current user
    notif_result = await session.execute(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.organization_id == org_id,
            Notification.is_read.is_(False),
        )
    )
    unread_count = notif_result.scalar() or 0

    # Design queue: work orders in the design phase (has design_details
    # and is still in an active stage)
    from app.models.design_details import DesignDetails

    design_result = await session.execute(
        select(func.count(DesignDetails.id))
        .join(WorkOrder, DesignDetails.work_order_id == WorkOrder.id)
        .where(
            WorkOrder.organization_id == org_id,
            WorkOrder.status_id.not_in(completed_stages),
        )
    )
    design_queue_count = design_result.scalar() or 0

    return BadgeCountsResponse(
        work_orders=work_orders_count,
        unread_notifications=unread_count,
        design_queue=design_queue_count,
    )
