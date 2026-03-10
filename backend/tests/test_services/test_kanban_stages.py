import uuid

from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.services.kanban_stages import DEFAULT_STAGES, KanbanStageService


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


async def test_seed_defaults(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    stages = await service.seed_defaults(org.id)
    assert len(stages) == len(DEFAULT_STAGES)
    assert stages[0].name == "Lead"
    assert stages[-1].name == "Cancelled"
    for stage in stages:
        assert stage.is_default is True
        assert stage.organization_id == org.id


async def test_list_stages_seeds_on_empty(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    stages = await service.list_stages(org.id)
    assert len(stages) == len(DEFAULT_STAGES)
    assert stages[0].position == 0
    assert stages[-1].position == 7


async def test_create_stage(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    stage = await service.create(
        organization_id=org.id,
        name="Custom",
        color="#abcdef",
        position=99,
    )
    assert stage.name == "Custom"
    assert stage.color == "#abcdef"
    assert stage.position == 99
    assert stage.system_status is None
    assert stage.organization_id == org.id


async def test_get_by_id(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    stage = await service.create(
        organization_id=org.id,
        name="Test",
    )
    found = await service.get_by_id(stage.id, org.id)
    assert found is not None
    assert found.id == stage.id


async def test_get_by_id_wrong_org(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    stage = await service.create(
        organization_id=org.id,
        name="Test",
    )
    found = await service.get_by_id(stage.id, uuid.uuid4())
    assert found is None


async def test_update_stage(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    stage = await service.create(
        organization_id=org.id,
        name="Old Name",
        color="#000000",
    )
    updated = await service.update_stage(
        stage_id=stage.id,
        organization_id=org.id,
        name="New Name",
        color="#ffffff",
    )
    assert updated is not None
    assert updated.name == "New Name"
    assert updated.color == "#ffffff"


async def test_update_stage_not_found(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    result = await service.update_stage(
        stage_id=uuid.uuid4(),
        organization_id=org.id,
        name="Nope",
    )
    assert result is None


async def test_delete_stage(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    stage = await service.create(
        organization_id=org.id,
        name="Deletable",
    )
    deleted = await service.delete_stage(stage.id, org.id)
    assert deleted is not None
    assert deleted.is_active is False


async def test_delete_stage_with_system_status_fails(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    stage = await service.create(
        organization_id=org.id,
        name="Lead",
        system_status=SystemStatus.LEAD,
    )
    result = await service.delete_stage(stage.id, org.id)
    assert result is None


async def test_delete_stage_not_found(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    result = await service.delete_stage(uuid.uuid4(), org.id)
    assert result is None


async def test_reorder(db_session):
    org = await _seed(db_session)
    service = KanbanStageService(db_session)

    s1 = await service.create(organization_id=org.id, name="A", position=0)
    s2 = await service.create(organization_id=org.id, name="B", position=1)

    stages = await service.reorder(
        organization_id=org.id,
        items=[
            {"id": s1.id, "position": 1},
            {"id": s2.id, "position": 0},
        ],
    )
    assert stages[0].name == "B"
    assert stages[1].name == "A"
