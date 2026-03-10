import uuid

from sqlalchemy import select

from app.models.organization import Organization
from app.models.plan import Plan
from app.models.vehicle import Vehicle, VehicleType


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


async def test_create_truck(db_session):
    org = await _seed(db_session)

    vehicle = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        vin="1HGCM82633A004352",
        year=2024,
        make="Ford",
        model="F-150",
        vehicle_type=VehicleType.PICKUP,
        truck_cab_size="crew",
        truck_bed_length="6.5ft",
    )
    db_session.add(vehicle)
    await db_session.commit()

    result = await db_session.execute(select(Vehicle).where(Vehicle.id == vehicle.id))
    saved = result.scalar_one()
    assert saved.vin == "1HGCM82633A004352"
    assert saved.year == 2024
    assert saved.make == "Ford"
    assert saved.model == "F-150"
    assert saved.vehicle_type == VehicleType.PICKUP
    assert saved.truck_cab_size == "crew"
    assert saved.truck_bed_length == "6.5ft"
    assert saved.organization_id == org.id
    assert saved.created_at is not None


async def test_create_van(db_session):
    org = await _seed(db_session)

    vehicle = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        year=2023,
        make="Mercedes",
        model="Sprinter",
        vehicle_type=VehicleType.VAN,
        van_roof_height="high",
        van_wheelbase="170",
        van_length="extended",
    )
    db_session.add(vehicle)
    await db_session.commit()

    result = await db_session.execute(select(Vehicle).where(Vehicle.id == vehicle.id))
    saved = result.scalar_one()
    assert saved.vehicle_type == VehicleType.VAN
    assert saved.van_roof_height == "high"
    assert saved.van_wheelbase == "170"
    assert saved.van_length == "extended"
    assert saved.vin is None
