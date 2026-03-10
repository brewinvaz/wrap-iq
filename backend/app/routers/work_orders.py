import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.kanban_stage import KanbanStage
from app.models.user import User
from app.schemas.work_orders import (
    StatusUpdate,
    WorkOrderCreate,
    WorkOrderListResponse,
    WorkOrderResponse,
    WorkOrderUpdate,
)
from app.services.work_orders import (
    create_work_order,
    get_work_order,
    list_work_orders,
    update_status,
    update_work_order,
)

router = APIRouter(prefix="/api/work-orders", tags=["work-orders"])


def _to_response(wo) -> WorkOrderResponse:
    vehicles = [
        {
            "id": wov.vehicle.id,
            "make": wov.vehicle.make,
            "model": wov.vehicle.model,
            "year": wov.vehicle.year,
            "vin": wov.vehicle.vin,
        }
        for wov in (wo.work_order_vehicles or [])
    ]
    return WorkOrderResponse(
        id=wo.id,
        job_number=wo.job_number,
        job_type=wo.job_type,
        job_value=wo.job_value,
        priority=wo.priority,
        date_in=wo.date_in,
        estimated_completion_date=wo.estimated_completion_date,
        completion_date=wo.completion_date,
        internal_notes=wo.internal_notes,
        status=wo.status,
        vehicles=vehicles,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
    )


@router.post("", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: WorkOrderCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Get first stage for org as default status
    result = await session.execute(
        select(KanbanStage)
        .where(
            KanbanStage.organization_id == user.organization_id,
            KanbanStage.is_active.is_(True),
        )
        .order_by(KanbanStage.position)
        .limit(1)
    )
    stage = result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=400, detail="No Kanban stages configured")

    wo_data = data.model_dump(exclude={"vehicle_ids"})
    wo = await create_work_order(
        session, user.organization_id, stage.id, wo_data, data.vehicle_ids
    )
    return _to_response(wo)


@router.get("", response_model=WorkOrderListResponse)
async def list_all(
    status_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    items, total = await list_work_orders(
        session, user.organization_id, status_id, skip, limit
    )
    return WorkOrderListResponse(
        items=[_to_response(wo) for wo in items],
        total=total,
    )


@router.get("/{work_order_id}", response_model=WorkOrderResponse)
async def get_one(
    work_order_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    wo = await get_work_order(session, work_order_id, user.organization_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return _to_response(wo)


@router.patch("/{work_order_id}", response_model=WorkOrderResponse)
async def update(
    work_order_id: uuid.UUID,
    data: WorkOrderUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    wo = await get_work_order(session, work_order_id, user.organization_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    updated = await update_work_order(session, wo, data.model_dump(exclude_unset=True))
    return _to_response(updated)


@router.patch("/{work_order_id}/status", response_model=WorkOrderResponse)
async def change_status(
    work_order_id: uuid.UUID,
    data: StatusUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    wo = await get_work_order(session, work_order_id, user.organization_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    # Verify the target stage belongs to the user's org
    stage_result = await session.execute(
        select(KanbanStage).where(
            KanbanStage.id == data.status_id,
            KanbanStage.organization_id == user.organization_id,
        )
    )
    if not stage_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Stage not found")

    updated = await update_status(session, wo, data.status_id)
    return _to_response(updated)
