import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import select

from app.models.estimate_defaults import EstimateDefaults
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.time_log import Phase, TimeLog, TimeLogStatus
from app.models.user import Role, User
from app.models.vehicle import VehicleType
from app.models.work_order import JobType, WorkOrder
from app.models.wrap_details import WrapCoverage


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

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="worker@shop.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add(user)
    await db_session.flush()

    wo = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-TL-001",
        status_id=stage.id,
        date_in=datetime.now(UTC),
    )
    db_session.add(wo)
    await db_session.flush()

    return org, user, wo


async def test_time_log_with_phase(db_session):
    org, user, wo = await _seed(db_session)

    tl = TimeLog(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=user.id,
        work_order_id=wo.id,
        task="Print full wrap panels",
        hours=Decimal("3.25"),
        log_date=date(2026, 3, 13),
        phase=Phase.PRODUCTION,
    )
    db_session.add(tl)
    await db_session.commit()

    result = await db_session.execute(select(TimeLog).where(TimeLog.id == tl.id))
    saved = result.scalar_one()
    assert saved.phase == Phase.PRODUCTION
    assert saved.hours == Decimal("3.25")
    assert saved.task == "Print full wrap panels"
    assert saved.status == TimeLogStatus.SUBMITTED
    assert saved.log_date == date(2026, 3, 13)


async def test_estimate_defaults_all_fields(db_session):
    org, user, wo = await _seed(db_session)

    ed = EstimateDefaults(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_type=JobType.commercial,
        vehicle_count_min=1,
        vehicle_count_max=5,
        wrap_coverage=WrapCoverage.FULL,
        vehicle_type=VehicleType.VAN,
        design_hours=Decimal("10.00"),
        production_hours=Decimal("8.00"),
        install_hours=Decimal("6.00"),
        priority=1,
        is_active=True,
    )
    db_session.add(ed)
    await db_session.commit()

    result = await db_session.execute(
        select(EstimateDefaults).where(EstimateDefaults.id == ed.id)
    )
    saved = result.scalar_one()
    assert saved.job_type == JobType.commercial
    assert saved.vehicle_count_min == 1
    assert saved.vehicle_count_max == 5
    assert saved.wrap_coverage == WrapCoverage.FULL
    assert saved.vehicle_type == VehicleType.VAN
    assert saved.design_hours == Decimal("10.00")
    assert saved.production_hours == Decimal("8.00")
    assert saved.install_hours == Decimal("6.00")
    assert saved.priority == 1
    assert saved.is_active is True
