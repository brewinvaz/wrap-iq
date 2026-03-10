import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
from app.models.notification import Notification, NotificationType
from app.models.plan import Plan


@pytest.fixture
async def seed_plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.commit()
    return plan


@pytest.fixture
async def client(db_session, seed_plan):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _register_user(client, email="admin@shop.com"):
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "pass", "org_name": "My Shop"},
    )
    return resp.json()["access_token"]


async def test_list_notifications_empty(client):
    token = await _register_user(client)
    resp = await client.get(
        "/api/notifications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_create_notification(client):
    token = await _register_user(client)

    # Get user info to get user_id
    me = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = me.json()["id"]

    resp = await client.post(
        "/api/notifications",
        json={
            "user_id": user_id,
            "title": "Test Notification",
            "message": "Hello world",
            "notification_type": "info",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test Notification"
    assert data["message"] == "Hello world"
    assert data["notification_type"] == "info"
    assert data["is_read"] is False


async def test_list_notifications_with_data(client):
    token = await _register_user(client)
    me = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = me.json()["id"]

    # Create 3 notifications
    for i in range(3):
        await client.post(
            "/api/notifications",
            json={
                "user_id": user_id,
                "title": f"Notification {i}",
                "message": f"Message {i}",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    resp = await client.get(
        "/api/notifications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3


async def test_get_unread_count(client):
    token = await _register_user(client)
    me = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = me.json()["id"]

    for i in range(2):
        await client.post(
            "/api/notifications",
            json={
                "user_id": user_id,
                "title": f"Notification {i}",
                "message": f"Message {i}",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    resp = await client.get(
        "/api/notifications/unread-count",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["count"] == 2


async def test_mark_as_read(client):
    token = await _register_user(client)
    me = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = me.json()["id"]

    create_resp = await client.post(
        "/api/notifications",
        json={
            "user_id": user_id,
            "title": "Test",
            "message": "Message",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    notification_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/notifications/{notification_id}/read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True
    assert resp.json()["read_at"] is not None


async def test_mark_as_read_not_found(client):
    token = await _register_user(client)
    fake_id = str(uuid.uuid4())
    resp = await client.patch(
        f"/api/notifications/{fake_id}/read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_mark_all_as_read(client):
    token = await _register_user(client)
    me = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = me.json()["id"]

    for i in range(3):
        await client.post(
            "/api/notifications",
            json={
                "user_id": user_id,
                "title": f"Notification {i}",
                "message": f"Message {i}",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    resp = await client.post(
        "/api/notifications/mark-all-read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert "3" in resp.json()["message"]

    # Verify unread count is 0
    count_resp = await client.get(
        "/api/notifications/unread-count",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert count_resp.json()["count"] == 0


async def test_delete_notification(client):
    token = await _register_user(client)
    me = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = me.json()["id"]

    create_resp = await client.post(
        "/api/notifications",
        json={
            "user_id": user_id,
            "title": "To delete",
            "message": "Will be deleted",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    notification_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/notifications/{notification_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    # Verify it's gone
    list_resp = await client.get(
        "/api/notifications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.json()["total"] == 0


async def test_delete_notification_not_found(client):
    token = await _register_user(client)
    fake_id = str(uuid.uuid4())
    resp = await client.delete(
        f"/api/notifications/{fake_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_notifications_require_auth(client):
    resp = await client.get("/api/notifications")
    assert resp.status_code in (401, 403)


async def test_list_unread_only(client):
    token = await _register_user(client)
    me = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = me.json()["id"]

    # Create 3 notifications
    ids = []
    for i in range(3):
        r = await client.post(
            "/api/notifications",
            json={
                "user_id": user_id,
                "title": f"Notification {i}",
                "message": f"Message {i}",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        ids.append(r.json()["id"])

    # Mark first as read
    await client.patch(
        f"/api/notifications/{ids[0]}/read",
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/notifications?unread_only=true",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
