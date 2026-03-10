import uuid

from app.models.notification import NotificationType
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User
from app.services.notifications import NotificationService


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
    service = NotificationService(db_session)

    notification = await service.create(
        organization_id=org.id,
        user_id=user.id,
        title="Test",
        message="Test message",
        notification_type=NotificationType.INFO,
    )

    assert notification.title == "Test"
    assert notification.message == "Test message"
    assert notification.notification_type == NotificationType.INFO
    assert notification.is_read is False
    assert notification.user_id == user.id


async def test_list_for_user(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    for i in range(5):
        await service.create(
            organization_id=org.id,
            user_id=user.id,
            title=f"Notification {i}",
            message=f"Message {i}",
        )

    notifications, total = await service.list_for_user(
        user_id=user.id, organization_id=org.id
    )
    assert total == 5
    assert len(notifications) == 5


async def test_list_for_user_unread_only(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    for i in range(3):
        await service.create(
            organization_id=org.id,
            user_id=user.id,
            title=f"Notification {i}",
            message=f"Message {i}",
        )

    # Mark first one as read
    notifications, _ = await service.list_for_user(
        user_id=user.id, organization_id=org.id
    )
    await service.mark_as_read(notifications[0].id, user.id)

    unread, total = await service.list_for_user(
        user_id=user.id, organization_id=org.id, unread_only=True
    )
    assert total == 2
    assert len(unread) == 2


async def test_list_for_user_pagination(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    for i in range(5):
        await service.create(
            organization_id=org.id,
            user_id=user.id,
            title=f"Notification {i}",
            message=f"Message {i}",
        )

    notifications, total = await service.list_for_user(
        user_id=user.id, organization_id=org.id, skip=0, limit=2
    )
    assert total == 5
    assert len(notifications) == 2


async def test_mark_as_read(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    notification = await service.create(
        organization_id=org.id,
        user_id=user.id,
        title="Test",
        message="Message",
    )

    updated = await service.mark_as_read(notification.id, user.id)
    assert updated is not None
    assert updated.is_read is True
    assert updated.read_at is not None


async def test_mark_as_read_wrong_user(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    notification = await service.create(
        organization_id=org.id,
        user_id=user.id,
        title="Test",
        message="Message",
    )

    result = await service.mark_as_read(notification.id, uuid.uuid4())
    assert result is None


async def test_mark_all_as_read(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    for i in range(3):
        await service.create(
            organization_id=org.id,
            user_id=user.id,
            title=f"Notification {i}",
            message=f"Message {i}",
        )

    count = await service.mark_all_as_read(user.id, org.id)
    assert count == 3

    unread_count = await service.get_unread_count(user.id, org.id)
    assert unread_count == 0


async def test_get_unread_count(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    for i in range(4):
        await service.create(
            organization_id=org.id,
            user_id=user.id,
            title=f"Notification {i}",
            message=f"Message {i}",
        )

    count = await service.get_unread_count(user.id, org.id)
    assert count == 4


async def test_delete_notification(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    notification = await service.create(
        organization_id=org.id,
        user_id=user.id,
        title="To delete",
        message="Will be deleted",
    )

    result = await service.delete(notification.id, user.id)
    assert result is True

    _, total = await service.list_for_user(user_id=user.id, organization_id=org.id)
    assert total == 0


async def test_delete_notification_wrong_user(db_session):
    org, user = await _seed(db_session)
    service = NotificationService(db_session)

    notification = await service.create(
        organization_id=org.id,
        user_id=user.id,
        title="Test",
        message="Message",
    )

    result = await service.delete(notification.id, uuid.uuid4())
    assert result is False
