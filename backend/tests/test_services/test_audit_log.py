import uuid

from app.models.audit_log import ActionType
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import User
from app.services.audit_log import AuditLogService


async def _setup(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
    )
    db_session.add(user)
    await db_session.flush()
    return org, user


async def test_create_audit_log(db_session):
    org, user = await _setup(db_session)
    service = AuditLogService(db_session)

    log = await service.create_log(
        organization_id=org.id,
        user_id=user.id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
        details={"job_number": "WO-1001"},
    )

    assert log.action == ActionType.PROJECT_CREATED
    assert log.user_id == user.id
    assert log.details["job_number"] == "WO-1001"


async def test_list_audit_logs(db_session):
    org, user = await _setup(db_session)
    service = AuditLogService(db_session)

    for action in [
        ActionType.PROJECT_CREATED,
        ActionType.PROJECT_UPDATED,
        ActionType.STATUS_CHANGED,
    ]:
        await service.create_log(
            organization_id=org.id,
            user_id=user.id,
            action=action,
            resource_type="work_order",
            resource_id=uuid.uuid4(),
        )

    logs, total = await service.list_logs(organization_id=org.id)
    assert total == 3
    assert len(logs) == 3


async def test_list_audit_logs_filtered_by_action(db_session):
    org, user = await _setup(db_session)
    service = AuditLogService(db_session)

    await service.create_log(
        organization_id=org.id,
        user_id=user.id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
    )
    await service.create_log(
        organization_id=org.id,
        user_id=user.id,
        action=ActionType.USER_CREATED,
        resource_type="user",
        resource_id=uuid.uuid4(),
    )

    logs, total = await service.list_logs(
        organization_id=org.id, action=ActionType.PROJECT_CREATED
    )
    assert total == 1
    assert logs[0].action == ActionType.PROJECT_CREATED


async def test_list_audit_logs_filtered_by_resource(db_session):
    org, user = await _setup(db_session)
    service = AuditLogService(db_session)

    resource_id = uuid.uuid4()
    await service.create_log(
        organization_id=org.id,
        user_id=user.id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=resource_id,
    )
    await service.create_log(
        organization_id=org.id,
        user_id=user.id,
        action=ActionType.PROJECT_UPDATED,
        resource_type="work_order",
        resource_id=resource_id,
    )
    await service.create_log(
        organization_id=org.id,
        user_id=user.id,
        action=ActionType.USER_CREATED,
        resource_type="user",
        resource_id=uuid.uuid4(),
    )

    logs, total = await service.list_logs(
        organization_id=org.id,
        resource_type="work_order",
        resource_id=resource_id,
    )
    assert total == 2


async def test_list_audit_logs_pagination(db_session):
    org, user = await _setup(db_session)
    service = AuditLogService(db_session)

    for i in range(5):
        await service.create_log(
            organization_id=org.id,
            user_id=user.id,
            action=ActionType.PROJECT_UPDATED,
            resource_type="work_order",
            resource_id=uuid.uuid4(),
        )

    logs, total = await service.list_logs(organization_id=org.id, limit=2, offset=0)
    assert total == 5
    assert len(logs) == 2

    logs2, total2 = await service.list_logs(organization_id=org.id, limit=2, offset=2)
    assert total2 == 5
    assert len(logs2) == 2
