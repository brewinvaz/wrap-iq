import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.design_details import DesignDetails
from app.models.install_details import InstallDetails
from app.models.production_details import ProductionDetails
from app.models.work_order import WorkOrder, WorkOrderVehicle
from app.models.wrap_details import WrapDetails


async def generate_job_number(session: AsyncSession, org_id: uuid.UUID) -> str:
    result = await session.execute(
        select(func.count(WorkOrder.id)).where(WorkOrder.organization_id == org_id)
    )
    count = result.scalar() or 0
    return f"WO-{count + 1:04d}"


async def create_work_order(
    session: AsyncSession,
    org_id: uuid.UUID,
    status_id: uuid.UUID,
    data: dict,
    vehicle_ids: list[uuid.UUID] | None = None,
    sub_details: dict | None = None,
) -> WorkOrder:
    wrap_data = (sub_details or {}).get("wrap_details")
    design_data = (sub_details or {}).get("design_details")
    production_data = (sub_details or {}).get("production_details")
    install_data = (sub_details or {}).get("install_details")

    job_number = await generate_job_number(session, org_id)
    wo = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org_id,
        job_number=job_number,
        status_id=status_id,
        **data,
    )
    session.add(wo)
    await session.flush()

    if vehicle_ids:
        for vid in vehicle_ids:
            session.add(
                WorkOrderVehicle(
                    work_order_id=wo.id, vehicle_id=vid, organization_id=org_id
                )
            )
        await session.flush()

    # Create sub-details if provided
    if wrap_data and vehicle_ids:
        # WrapDetails requires a vehicle_id FK — only create when vehicles exist
        for vid in vehicle_ids:
            session.add(
                WrapDetails(
                    id=uuid.uuid4(),
                    work_order_id=wo.id,
                    vehicle_id=vid,
                    organization_id=org_id,
                    **wrap_data,
                )
            )

    if design_data:
        session.add(
            DesignDetails(
                id=uuid.uuid4(),
                work_order_id=wo.id,
                organization_id=org_id,
                **design_data,
            )
        )

    if production_data:
        session.add(
            ProductionDetails(
                id=uuid.uuid4(),
                work_order_id=wo.id,
                organization_id=org_id,
                **production_data,
            )
        )

    if install_data:
        session.add(
            InstallDetails(
                id=uuid.uuid4(),
                work_order_id=wo.id,
                organization_id=org_id,
                **install_data,
            )
        )

    await session.commit()

    result = await session.execute(
        select(WorkOrder).where(WorkOrder.id == wo.id)
    )
    return result.scalar_one()


async def get_work_order(
    session: AsyncSession, wo_id: uuid.UUID, org_id: uuid.UUID
) -> WorkOrder | None:
    result = await session.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.work_order_vehicles))
        .where(WorkOrder.id == wo_id, WorkOrder.organization_id == org_id)
    )
    return result.scalar_one_or_none()


async def list_work_orders(
    session: AsyncSession,
    org_id: uuid.UUID,
    status_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
) -> tuple[list[WorkOrder], int]:
    query = select(WorkOrder).where(WorkOrder.organization_id == org_id)
    count_query = select(func.count(WorkOrder.id)).where(
        WorkOrder.organization_id == org_id
    )

    if status_id:
        query = query.where(WorkOrder.status_id == status_id)
        count_query = count_query.where(WorkOrder.status_id == status_id)

    if search:
        pattern = f"%{search}%"
        search_filter = or_(
            WorkOrder.job_number.ilike(pattern),
            WorkOrder.client.has(Client.name.ilike(pattern)),
        )
        query = query.where(search_filter)
        count_query = count_query.where(
            or_(
                WorkOrder.job_number.ilike(pattern),
                WorkOrder.client_id.in_(
                    select(Client.id).where(Client.name.ilike(pattern))
                ),
            )
        )

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        query.options(
            selectinload(WorkOrder.work_order_vehicles),
            selectinload(WorkOrder.status),
            selectinload(WorkOrder.client),
        )
        .order_by(WorkOrder.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await session.execute(query)
    return list(result.scalars().all()), total


async def update_work_order(
    session: AsyncSession, wo: WorkOrder, data: dict
) -> WorkOrder:
    for key, value in data.items():
        setattr(wo, key, value)
    await session.commit()
    await session.refresh(wo)
    return wo


async def update_status(
    session: AsyncSession, wo: WorkOrder, status_id: uuid.UUID
) -> WorkOrder:
    wo.status_id = status_id
    timestamps = wo.status_timestamps or {}
    timestamps[str(status_id)] = datetime.now(UTC).isoformat()
    wo.status_timestamps = timestamps
    await session.commit()
    await session.refresh(wo)
    return wo
