import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select

from app.models.design_details import DesignDetails
from app.models.install_details import (
    InstallDetails,
    InstallDifficulty,
    InstallLocation,
    InstallTimeLog,
    LogType,
)
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.production_details import ProductionDetails
from app.models.user import Role, User
from app.models.vehicle import Vehicle, VehicleType
from app.models.work_order import WorkOrder
from app.models.wrap_details import WrapCoverage, WrapDetails


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

    vehicle = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        make="Ford",
        model="Transit",
        vehicle_type=VehicleType.VAN,
    )
    db_session.add(vehicle)
    await db_session.flush()

    wo = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-0001",
        status_id=stage.id,
        date_in=datetime.now(UTC),
    )
    db_session.add(wo)
    await db_session.flush()

    return org, wo, vehicle


async def test_wrap_details(db_session):
    org, wo, vehicle = await _seed(db_session)

    wd = WrapDetails(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        vehicle_id=vehicle.id,
        organization_id=org.id,
        wrap_coverage=WrapCoverage.FULL,
        misc_items=["mirrors", "door_jambs"],
        special_wrap_instructions="Match PMS 186C red",
    )
    db_session.add(wd)
    await db_session.commit()

    result = await db_session.execute(
        select(WrapDetails).where(WrapDetails.id == wd.id)
    )
    saved = result.scalar_one()
    assert saved.wrap_coverage == WrapCoverage.FULL
    assert saved.misc_items == ["mirrors", "door_jambs"]
    assert saved.special_wrap_instructions == "Match PMS 186C red"


async def test_design_details(db_session):
    org, wo, vehicle = await _seed(db_session)

    dd = DesignDetails(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        organization_id=org.id,
        design_hours=Decimal("12.50"),
        design_version_count=3,
        revision_count=2,
        proofing_data={"approved": True, "approved_by": "client@example.com"},
    )
    db_session.add(dd)
    await db_session.commit()

    result = await db_session.execute(
        select(DesignDetails).where(DesignDetails.id == dd.id)
    )
    saved = result.scalar_one()
    assert saved.design_hours == Decimal("12.50")
    assert saved.design_version_count == 3
    assert saved.proofing_data["approved"] is True


async def test_production_details(db_session):
    org, wo, vehicle = await _seed(db_session)

    pd = ProductionDetails(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        organization_id=org.id,
        assigned_equipment="Roland TrueVIS VG3-640",
        print_media_brand_type="3M IJ180Cv3",
        print_media_width="54in",
        media_print_length=Decimal("120.50"),
        sq_ft_printed_and_waste=Decimal("540.00"),
    )
    db_session.add(pd)
    await db_session.commit()

    result = await db_session.execute(
        select(ProductionDetails).where(ProductionDetails.id == pd.id)
    )
    saved = result.scalar_one()
    assert saved.assigned_equipment == "Roland TrueVIS VG3-640"
    assert saved.media_print_length == Decimal("120.50")
    assert saved.sq_ft_printed_and_waste == Decimal("540.00")


async def test_install_details_with_time_log(db_session):
    org, wo, vehicle = await _seed(db_session)

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="installer@shop.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add(user)
    await db_session.flush()

    inst = InstallDetails(
        id=uuid.uuid4(),
        work_order_id=wo.id,
        organization_id=org.id,
        install_location=InstallLocation.IN_SHOP,
        install_difficulty=InstallDifficulty.COMPLEX,
        install_start_date=datetime.now(UTC),
    )
    db_session.add(inst)
    await db_session.flush()

    log = InstallTimeLog(
        id=uuid.uuid4(),
        install_details_id=inst.id,
        user_id=user.id,
        log_type=LogType.INSTALL,
        hours=Decimal("4.50"),
        notes="Completed driver side",
    )
    db_session.add(log)
    await db_session.commit()

    result = await db_session.execute(
        select(InstallDetails).where(InstallDetails.id == inst.id)
    )
    saved = result.scalar_one()
    assert saved.install_location == InstallLocation.IN_SHOP
    assert saved.install_difficulty == InstallDifficulty.COMPLEX

    log_result = await db_session.execute(
        select(InstallTimeLog).where(InstallTimeLog.install_details_id == inst.id)
    )
    saved_log = log_result.scalar_one()
    assert saved_log.hours == Decimal("4.50")
    assert saved_log.log_type == LogType.INSTALL
    assert saved_log.notes == "Completed driver side"
