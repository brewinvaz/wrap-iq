import uuid

from sqlalchemy import select

from app.models.notification import Notification, NotificationType
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="user@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(user)
    await db_session.flush()
    return org, user


async def test_create_notification(db_session):
    org, user = await _seed(db_session)

    notification = Notification(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=user.id,
        title="Test Notification",
        message="This is a test notification",
        notification_type=NotificationType.INFO,
    )
    db_session.add(notification)
    await db_session.commit()

    result = await db_session.execute(
        select(Notification).where(Notification.id == notification.id)
    )
    saved = result.scalar_one()
    assert saved.title == "Test Notification"
    assert saved.message == "This is a test notification"
    assert saved.notification_type == NotificationType.INFO
    assert saved.is_read is False
    assert saved.read_at is None
    assert saved.user_id == user.id
    assert saved.organization_id == org.id


async def test_notification_types(db_session):
    org, user = await _seed(db_session)

    for ntype in NotificationType:
        notification = Notification(
            id=uuid.uuid4(),
            organization_id=org.id,
            user_id=user.id,
            title=f"{ntype.value} notification",
            message=f"Type: {ntype.value}",
            notification_type=ntype,
        )
        db_session.add(notification)

    await db_session.commit()

    result = await db_session.execute(select(Notification))
    notifications = result.scalars().all()
    assert len(notifications) == 4


async def test_notification_defaults(db_session):
    org, user = await _seed(db_session)

    notification = Notification(
        id=uuid.uuid4(),
        organization_id=org.id,
        user_id=user.id,
        title="Default test",
        message="Testing defaults",
    )
    db_session.add(notification)
    await db_session.commit()

    result = await db_session.execute(
        select(Notification).where(Notification.id == notification.id)
    )
    saved = result.scalar_one()
    assert saved.is_read is False
    assert saved.notification_type == NotificationType.INFO
    assert saved.created_at is not None
    assert saved.updated_at is not None
