import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.vehicle import Vehicle, VehicleType
from app.models.work_order import JobType, Priority, WorkOrder, WorkOrderVehicle


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Lead",
        position=0,
        system_status=SystemStatus.LEAD,
        is_default=True,
        is_active=True,
    )
    db_session.add(stage)
    await db_session.flush()

    return org, stage


async def test_create_work_order(db_session):
    org, stage = await _seed(db_session)

    wo = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-0001",
        job_type=JobType.COMMERCIAL,
        job_value=5000,
        status_id=stage.id,
        priority=Priority.HIGH,
        date_in=datetime.now(UTC),
        internal_notes="Rush job",
    )
    db_session.add(wo)
    await db_session.commit()

    result = await db_session.execute(select(WorkOrder).where(WorkOrder.id == wo.id))
    saved = result.scalar_one()
    assert saved.job_number == "WO-0001"
    assert saved.job_type == JobType.COMMERCIAL
    assert saved.job_value == 5000
    assert saved.priority == Priority.HIGH
    assert saved.internal_notes == "Rush job"
    assert saved.status_id == stage.id
    assert saved.created_at is not None


async def test_work_order_with_multiple_vehicles(db_session):
    org, stage = await _seed(db_session)

    v1 = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        make="Ford",
        model="Transit",
        vehicle_type=VehicleType.VAN,
    )
    v2 = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        make="Chevy",
        model="Express",
        vehicle_type=VehicleType.VAN,
    )
    db_session.add_all([v1, v2])
    await db_session.flush()

    wo = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-0002",
        status_id=stage.id,
        date_in=datetime.now(UTC),
    )
    db_session.add(wo)
    await db_session.flush()

    db_session.add(WorkOrderVehicle(work_order_id=wo.id, vehicle_id=v1.id))
    db_session.add(WorkOrderVehicle(work_order_id=wo.id, vehicle_id=v2.id))
    await db_session.commit()

    result = await db_session.execute(
        select(WorkOrderVehicle).where(WorkOrderVehicle.work_order_id == wo.id)
    )
    links = result.scalars().all()
    assert len(links) == 2
    vehicle_ids = {link.vehicle_id for link in links}
    assert v1.id in vehicle_ids
    assert v2.id in vehicle_ids
