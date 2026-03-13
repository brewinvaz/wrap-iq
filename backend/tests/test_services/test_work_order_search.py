import uuid
from datetime import UTC, datetime

from app.models.client import Client
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.vehicle import Vehicle, VehicleType
from app.models.work_order import JobType, Priority, WorkOrder, WorkOrderVehicle
from app.services.work_orders import list_work_orders


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
        name="In Production",
        position=0,
        system_status=SystemStatus.IN_PROGRESS,
        is_default=True,
        is_active=True,
    )
    db_session.add(stage)
    await db_session.flush()

    # Create a client
    client = Client(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Acme Corp",
        email="acme@example.com",
    )
    db_session.add(client)
    await db_session.flush()

    # Create vehicles
    ford = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        make="Ford",
        model="Transit",
        year=2024,
        vehicle_type=VehicleType.VAN,
    )
    chevy = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        make="Chevrolet",
        model="Express",
        year=2023,
        vehicle_type=VehicleType.VAN,
    )
    db_session.add_all([ford, chevy])
    await db_session.flush()

    # Work order 1: Acme Corp with Ford Transit
    wo1 = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-0001",
        job_type=JobType.commercial,
        job_value=5000,
        status_id=stage.id,
        priority=Priority.high,
        date_in=datetime.now(UTC),
        client_id=client.id,
    )
    db_session.add(wo1)
    await db_session.flush()

    db_session.add(
        WorkOrderVehicle(
            work_order_id=wo1.id, vehicle_id=ford.id, organization_id=org.id
        )
    )

    # Work order 2: no client, with Chevy Express
    wo2 = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-0002",
        job_type=JobType.personal,
        status_id=stage.id,
        priority=Priority.medium,
        date_in=datetime.now(UTC),
    )
    db_session.add(wo2)
    await db_session.flush()

    db_session.add(
        WorkOrderVehicle(
            work_order_id=wo2.id, vehicle_id=chevy.id, organization_id=org.id
        )
    )

    await db_session.commit()
    return org, wo1, wo2


async def test_search_by_vehicle_make(db_session):
    org, wo1, wo2 = await _seed(db_session)

    results, total = await list_work_orders(db_session, org.id, search="Ford")
    assert total == 1
    assert results[0].id == wo1.id


async def test_search_by_vehicle_model(db_session):
    org, wo1, wo2 = await _seed(db_session)

    results, total = await list_work_orders(db_session, org.id, search="Transit")
    assert total == 1
    assert results[0].id == wo1.id


async def test_search_by_vehicle_year(db_session):
    org, wo1, wo2 = await _seed(db_session)

    results, total = await list_work_orders(db_session, org.id, search="2023")
    assert total == 1
    assert results[0].id == wo2.id


async def test_search_by_client_name(db_session):
    org, wo1, wo2 = await _seed(db_session)

    results, total = await list_work_orders(db_session, org.id, search="Acme")
    assert total == 1
    assert results[0].id == wo1.id


async def test_search_by_job_number(db_session):
    org, wo1, wo2 = await _seed(db_session)

    results, total = await list_work_orders(db_session, org.id, search="WO-0002")
    assert total == 1
    assert results[0].id == wo2.id


async def test_search_returns_all_on_no_filter(db_session):
    org, wo1, wo2 = await _seed(db_session)

    results, total = await list_work_orders(db_session, org.id)
    assert total == 2


async def test_search_results_include_vehicle_and_client_data(db_session):
    org, wo1, wo2 = await _seed(db_session)

    results, total = await list_work_orders(db_session, org.id, search="Acme")
    assert total == 1
    wo = results[0]
    # Client data loaded
    assert wo.client is not None
    assert wo.client.name == "Acme Corp"
    # Vehicle data loaded via work_order_vehicles
    assert len(wo.work_order_vehicles) == 1
    assert wo.work_order_vehicles[0].vehicle.make == "Ford"
    # Status loaded
    assert wo.status is not None
    assert wo.status.name == "In Production"
