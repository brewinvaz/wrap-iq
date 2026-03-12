import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.client import Client
from app.models.kanban_stage import KanbanStage
from app.models.user import User
from app.models.vehicle import Vehicle
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


async def _validate_vehicle_ownership(
    session: AsyncSession,
    vehicle_ids: list[uuid.UUID],
    org_id: uuid.UUID,
) -> None:
    """Verify all vehicles belong to the user's organization."""
    if not vehicle_ids:
        return
    result = await session.execute(
        select(Vehicle.id).where(
            Vehicle.id.in_(vehicle_ids),
            Vehicle.organization_id == org_id,
        )
    )
    found_ids = {row[0] for row in result.all()}
    missing = set(vehicle_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=403,
            detail="Vehicles not found in your organization: "
            f"{sorted(str(v) for v in missing)}",
        )


async def _validate_client_ownership(
    session: AsyncSession,
    client_id: uuid.UUID | None,
    org_id: uuid.UUID,
) -> None:
    """Verify the client belongs to the user's organization."""
    if client_id is None:
        return
    result = await session.execute(
        select(Client.id).where(
            Client.id == client_id,
            Client.organization_id == org_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=403,
            detail="Client not found in your organization",
        )


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

    # Get first wrap_details if any exist (wrap_details is a list relationship)
    wrap = wo.wrap_details[0] if wo.wrap_details else None

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
        checklist=wo.checklist,
        status=wo.status,
        vehicles=vehicles,
        client_id=wo.client_id,
        client_name=wo.client.name if wo.client else None,
        wrap_details=wrap,
        design_details=wo.design_details,
        production_details=wo.production_details,
        install_details=wo.install_details,
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

    # Validate tenant ownership of vehicles and client
    await _validate_vehicle_ownership(session, data.vehicle_ids, user.organization_id)
    await _validate_client_ownership(session, data.client_id, user.organization_id)

    # Separate base fields from sub-details
    wo_data = data.model_dump(
        exclude={
            "vehicle_ids",
            "wrap_details",
            "design_details",
            "production_details",
            "install_details",
        }
    )
    sub_details = {
        "wrap_details": (
            data.wrap_details.model_dump()
            if data.wrap_details
            else None
        ),
        "design_details": (
            data.design_details.model_dump()
            if data.design_details
            else None
        ),
        "production_details": (
            data.production_details.model_dump()
            if data.production_details
            else None
        ),
        "install_details": (
            data.install_details.model_dump()
            if data.install_details
            else None
        ),
    }

    wo = await create_work_order(
        session, user.organization_id, stage.id, wo_data, data.vehicle_ids, sub_details
    )
    return _to_response(wo)


@router.get("", response_model=WorkOrderListResponse)
async def list_all(
    status_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None, max_length=200),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    items, total = await list_work_orders(
        session, user.organization_id, status_id, skip, limit, search=search
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

    # Validate tenant ownership of client if being updated
    if data.client_id is not None:
        await _validate_client_ownership(session, data.client_id, user.organization_id)

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

    # Verify the target stage belongs to the user's org and is active
    stage_result = await session.execute(
        select(KanbanStage).where(
            KanbanStage.id == data.status_id,
            KanbanStage.organization_id == user.organization_id,
        )
    )
    target_stage = stage_result.scalar_one_or_none()
    if not target_stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    if not target_stage.is_active:
        raise HTTPException(status_code=400, detail="Cannot move to an inactive stage")

    updated = await update_status(session, wo, data.status_id)
    return _to_response(updated)
