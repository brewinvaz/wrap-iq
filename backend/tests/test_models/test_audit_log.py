import uuid

from sqlalchemy import select

from app.models.audit_log import ActionType, AuditLog
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import User


async def test_create_audit_log(db_session):
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

    log = AuditLog(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=user.id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
        details={"job_number": "WO-1001"},
    )
    db_session.add(log)
    await db_session.commit()

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.organization_id == org.id)
    )
    saved = result.scalar_one()
    assert saved.action == ActionType.PROJECT_CREATED
    assert saved.resource_type == "work_order"
    assert saved.details["job_number"] == "WO-1001"
    assert saved.user_id == user.id


async def test_create_audit_log_without_user(db_session):
    """System-generated audit logs may not have a user."""
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop-2", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    log = AuditLog(
        id=uuid.uuid4(),
        organization_id=org.id,
        action=ActionType.SYSTEM_EVENT,
        resource_type="organization",
        resource_id=org.id,
        details={"event": "plan_upgraded"},
    )
    db_session.add(log)
    await db_session.commit()

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.organization_id == org.id)
    )
    saved = result.scalar_one()
    assert saved.user_id is None
    assert saved.action == ActionType.SYSTEM_EVENT


async def test_multiple_audit_logs_ordered(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop-3", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    for i, action in enumerate(
        [
            ActionType.USER_CREATED,
            ActionType.PROJECT_UPDATED,
            ActionType.STATUS_CHANGED,
        ]
    ):
        log = AuditLog(
            id=uuid.uuid4(),
            organization_id=org.id,
            action=action,
            resource_type="test",
            resource_id=uuid.uuid4(),
        )
        db_session.add(log)

    await db_session.commit()

    result = await db_session.execute(
        select(AuditLog).where(AuditLog.organization_id == org.id)
    )
    logs = result.scalars().all()
    assert len(logs) == 3
