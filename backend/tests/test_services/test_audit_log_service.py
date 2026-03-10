import uuid

import pytest

from app.models.audit_log import ActionType
from app.models.organization import Organization
from app.models.plan import Plan
from app.services.audit_log import AuditLogService


@pytest.fixture
async def plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    return plan


@pytest.fixture
async def orgs(db_session, plan):
    org_a = Organization(id=uuid.uuid4(), name="Org A", slug="org-a", plan_id=plan.id)
    org_b = Organization(id=uuid.uuid4(), name="Org B", slug="org-b", plan_id=plan.id)
    db_session.add_all([org_a, org_b])
    await db_session.flush()
    return {"a": org_a, "b": org_b}


@pytest.fixture
async def audit_service(db_session):
    return AuditLogService(db_session)


async def test_list_all_logs_returns_cross_org(db_session, orgs, audit_service):
    await audit_service.create_log(
        organization_id=orgs["a"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await audit_service.create_log(
        organization_id=orgs["b"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await db_session.commit()

    logs, total = await audit_service.list_all_logs()
    assert total == 2
    assert len(logs) == 2


async def test_list_all_logs_filters_by_org(db_session, orgs, audit_service):
    await audit_service.create_log(
        organization_id=orgs["a"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await audit_service.create_log(
        organization_id=orgs["b"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await db_session.commit()

    logs, total = await audit_service.list_all_logs(organization_id=orgs["a"].id)
    assert total == 1
    assert logs[0].organization_id == orgs["a"].id


async def test_list_all_logs_filters_by_action(db_session, orgs, audit_service):
    await audit_service.create_log(
        organization_id=orgs["a"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await audit_service.create_log(
        organization_id=orgs["a"].id,
        action=ActionType.SUPERADMIN_ACTION,
        resource_type="organization",
    )
    await db_session.commit()

    logs, total = await audit_service.list_all_logs(action=ActionType.SUPERADMIN_ACTION)
    assert total == 1
    assert logs[0].action == ActionType.SUPERADMIN_ACTION


async def test_list_all_logs_pagination(db_session, orgs, audit_service):
    for _ in range(5):
        await audit_service.create_log(
            organization_id=orgs["a"].id,
            action=ActionType.USER_CREATED,
            resource_type="user",
        )
    await db_session.commit()

    logs, total = await audit_service.list_all_logs(limit=2, offset=0)
    assert total == 5
    assert len(logs) == 2

    logs, total = await audit_service.list_all_logs(limit=2, offset=4)
    assert total == 5
    assert len(logs) == 1
