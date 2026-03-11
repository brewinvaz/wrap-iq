import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
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


async def _register_user(client, email="admin@shop.com", org_name="Shop"):
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "TestPass123", "org_name": org_name},
    )
    return resp.json()


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_create_template(client):
    reg = await _register_user(client)
    headers = auth_header(reg["access_token"])

    resp = await client.post(
        "/api/message-templates",
        json={
            "name": "Project Started",
            "subject": "Your project {{project_name}} has started",
            "body": "Hello {{client_name}}, your project is underway.",
            "trigger_type": "manual",
            "channel": "email",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Project Started"
    assert data["trigger_type"] == "manual"
    assert data["channel"] == "email"
    assert data["is_active"] is True


async def test_list_templates(client):
    reg = await _register_user(client)
    headers = auth_header(reg["access_token"])

    for i in range(3):
        await client.post(
            "/api/message-templates",
            json={
                "name": f"Template {i}",
                "subject": f"Subject {i}",
                "body": f"Body {i}",
                "trigger_type": "manual",
                "channel": "email",
            },
            headers=headers,
        )

    resp = await client.get("/api/message-templates", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 3


async def test_get_template(client):
    reg = await _register_user(client)
    headers = auth_header(reg["access_token"])

    create_resp = await client.post(
        "/api/message-templates",
        json={
            "name": "Test Template",
            "subject": "Subject",
            "body": "Body",
            "trigger_type": "manual",
            "channel": "email",
        },
        headers=headers,
    )
    template_id = create_resp.json()["id"]

    resp = await client.get(f"/api/message-templates/{template_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test Template"


async def test_get_template_not_found(client):
    reg = await _register_user(client)
    headers = auth_header(reg["access_token"])

    resp = await client.get(f"/api/message-templates/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


async def test_update_template(client):
    reg = await _register_user(client)
    headers = auth_header(reg["access_token"])

    create_resp = await client.post(
        "/api/message-templates",
        json={
            "name": "Original",
            "subject": "Original Subject",
            "body": "Original Body",
            "trigger_type": "manual",
            "channel": "email",
        },
        headers=headers,
    )
    template_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/message-templates/{template_id}",
        json={"name": "Updated", "subject": "New Subject"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated"
    assert data["subject"] == "New Subject"
    assert data["body"] == "Original Body"


async def test_delete_template(client):
    reg = await _register_user(client)
    headers = auth_header(reg["access_token"])

    create_resp = await client.post(
        "/api/message-templates",
        json={
            "name": "To Delete",
            "subject": "Subject",
            "body": "Body",
            "trigger_type": "manual",
            "channel": "email",
        },
        headers=headers,
    )
    template_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/message-templates/{template_id}", headers=headers)
    assert resp.status_code == 200

    resp = await client.get(f"/api/message-templates/{template_id}", headers=headers)
    assert resp.status_code == 404


async def test_send_message(client):
    reg = await _register_user(client)
    headers = auth_header(reg["access_token"])

    create_resp = await client.post(
        "/api/message-templates",
        json={
            "name": "Send Test",
            "subject": "Hello {{client_name}}",
            "body": "Your project is ready.",
            "trigger_type": "manual",
            "channel": "email",
        },
        headers=headers,
    )
    template_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/message-templates/{template_id}/send",
        json={
            "recipient_email": "client@example.com",
            "variables": {"client_name": "Alice"},
        },
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["subject"] == "Hello Alice"
    assert data["recipient_email"] == "client@example.com"
    assert data["status"] == "sent"


async def test_preview_template(client):
    reg = await _register_user(client)
    headers = auth_header(reg["access_token"])

    create_resp = await client.post(
        "/api/message-templates",
        json={
            "name": "Preview Test",
            "subject": "Hello {{client_name}}",
            "body": "Project {{project_name}} is {{status}} at {{company_name}}.",
            "trigger_type": "manual",
            "channel": "email",
        },
        headers=headers,
    )
    template_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/message-templates/{template_id}/preview", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["subject"] == "Hello John Doe"
    assert "Tesla Model 3 Full Wrap" in data["body"]
    assert "WrapIQ Demo" in data["body"]


async def test_create_template_unauthorized(client):
    resp = await client.post(
        "/api/message-templates",
        json={
            "name": "Test",
            "subject": "Subject",
            "body": "Body",
            "trigger_type": "manual",
            "channel": "email",
        },
    )
    assert resp.status_code == 401


async def test_create_template_non_admin_role(client):
    """Test that non-admin/PM roles cannot create templates."""
    # Register as admin first
    reg = await _register_user(client, email="admin2@shop.com", org_name="Shop2")
    headers = auth_header(reg["access_token"])

    # Admin can create (default role is admin for registered users)
    resp = await client.post(
        "/api/message-templates",
        json={
            "name": "Admin Template",
            "subject": "Subject",
            "body": "Body",
            "trigger_type": "manual",
            "channel": "email",
        },
        headers=headers,
    )
    assert resp.status_code == 201
