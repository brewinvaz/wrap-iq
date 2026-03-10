import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.auth.jwt import create_access_token
from app.main import app
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


@pytest.fixture
async def seed_data(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    installer = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="installer@shop.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add_all([admin, installer])
    await db_session.commit()

    return {
        "org": org,
        "admin": admin,
        "installer": installer,
    }


@pytest.fixture
async def client(db_session, seed_data):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def make_token(user: User) -> dict:
    token = create_access_token(
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
    )
    return {"Authorization": f"Bearer {token}"}


async def _create_webhook(client, headers):
    resp = await client.post(
        "/api/webhooks",
        json={
            "name": "Test Webhook",
            "url": "https://example.com/webhook",
            "events": ["project.created", "client.created"],
            "description": "A test webhook",
        },
        headers=headers,
    )
    return resp


async def test_create_webhook_endpoint(client, seed_data):
    headers = make_token(seed_data["admin"])
    resp = await _create_webhook(client, headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Webhook"
    assert data["url"] == "https://example.com/webhook"
    assert data["events"] == ["project.created", "client.created"]
    assert data["is_active"] is True
    assert data["secret"] is not None
    assert data["description"] == "A test webhook"


async def test_list_webhooks_endpoint(client, seed_data):
    headers = make_token(seed_data["admin"])
    await _create_webhook(client, headers)
    await client.post(
        "/api/webhooks",
        json={
            "name": "Second Webhook",
            "url": "https://example.com/hook2",
            "events": ["invoice.created"],
        },
        headers=headers,
    )

    resp = await client.get("/api/webhooks", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_get_webhook_endpoint(client, seed_data):
    headers = make_token(seed_data["admin"])
    create_resp = await _create_webhook(client, headers)
    webhook_id = create_resp.json()["id"]

    resp = await client.get(f"/api/webhooks/{webhook_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test Webhook"


async def test_update_webhook_endpoint(client, seed_data):
    headers = make_token(seed_data["admin"])
    create_resp = await _create_webhook(client, headers)
    webhook_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/webhooks/{webhook_id}",
        json={"name": "Updated Webhook", "is_active": False},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Webhook"
    assert data["is_active"] is False


async def test_delete_webhook_endpoint(client, seed_data):
    headers = make_token(seed_data["admin"])
    create_resp = await _create_webhook(client, headers)
    webhook_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/webhooks/{webhook_id}", headers=headers)
    assert resp.status_code == 204

    resp = await client.get(f"/api/webhooks/{webhook_id}", headers=headers)
    assert resp.status_code == 404


async def test_regenerate_secret_endpoint(client, seed_data):
    headers = make_token(seed_data["admin"])
    create_resp = await _create_webhook(client, headers)
    webhook_id = create_resp.json()["id"]
    old_secret = create_resp.json()["secret"]

    resp = await client.post(
        f"/api/webhooks/{webhook_id}/regenerate-secret", headers=headers
    )
    assert resp.status_code == 200
    assert resp.json()["secret"] != old_secret


async def test_get_deliveries_endpoint(client, seed_data):
    headers = make_token(seed_data["admin"])
    create_resp = await _create_webhook(client, headers)
    webhook_id = create_resp.json()["id"]

    resp = await client.get(f"/api/webhooks/{webhook_id}/deliveries", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


async def test_test_webhook_endpoint(client, seed_data):
    headers = make_token(seed_data["admin"])
    create_resp = await _create_webhook(client, headers)
    webhook_id = create_resp.json()["id"]

    from unittest.mock import AsyncMock, patch

    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.text = "OK"

    with patch("app.services.webhooks.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        resp = await client.post(f"/api/webhooks/{webhook_id}/test", headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["event_type"] == "webhook.test"
    assert data["success"] is True


async def test_non_admin_forbidden(client, seed_data):
    headers = make_token(seed_data["installer"])
    resp = await client.get("/api/webhooks", headers=headers)
    assert resp.status_code == 403


async def test_unauthorized_returns_401(client, seed_data):
    resp = await client.get("/api/webhooks")
    assert resp.status_code == 401
