import uuid

from sqlalchemy import select

from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


async def test_create_kanban_stage(db_session):
    org = await _seed(db_session)

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Lead",
        color="#64748b",
        position=0,
        system_status=SystemStatus.LEAD,
        is_default=True,
    )
    db_session.add(stage)
    await db_session.commit()

    result = await db_session.execute(
        select(KanbanStage).where(KanbanStage.id == stage.id)
    )
    saved = result.scalar_one()
    assert saved.name == "Lead"
    assert saved.color == "#64748b"
    assert saved.position == 0
    assert saved.system_status == SystemStatus.LEAD
    assert saved.is_default is True
    assert saved.is_active is True
    assert saved.organization_id == org.id


async def test_kanban_stage_nullable_system_status(db_session):
    org = await _seed(db_session)

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Custom Stage",
        color="#ff0000",
        position=10,
    )
    db_session.add(stage)
    await db_session.commit()

    result = await db_session.execute(
        select(KanbanStage).where(KanbanStage.id == stage.id)
    )
    saved = result.scalar_one()
    assert saved.system_status is None
    assert saved.is_default is False


async def test_kanban_stage_system_status_values(db_session):
    org = await _seed(db_session)

    for i, status in enumerate(SystemStatus):
        stage = KanbanStage(
            id=uuid.uuid4(),
            organization_id=org.id,
            name=f"Stage {status.value}",
            color="#000000",
            position=i,
            system_status=status,
        )
        db_session.add(stage)

    await db_session.commit()

    result = await db_session.execute(select(KanbanStage))
    stages = result.scalars().all()
    assert len(stages) == 4


async def test_kanban_stage_defaults(db_session):
    org = await _seed(db_session)

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Minimal Stage",
    )
    db_session.add(stage)
    await db_session.commit()

    result = await db_session.execute(
        select(KanbanStage).where(KanbanStage.id == stage.id)
    )
    saved = result.scalar_one()
    assert saved.is_active is True
    assert saved.is_default is False
    assert saved.created_at is not None
    assert saved.updated_at is not None
