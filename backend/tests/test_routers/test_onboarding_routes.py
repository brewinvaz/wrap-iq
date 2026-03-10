import secrets
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
from app.models.client_invite import ClientInvite
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


@pytest.fixture
async def seed_data(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(), name="Wrap Shop", slug="wrap-shop", plan_id=plan.id
    )
    db_session.add(org)
    await db_session.flush()

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Lead",
        system_status=SystemStatus.LEAD,
        position=0,
        is_default=True,
    )
    db_session.add(stage)

    admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@wrapshop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(admin)
    await db_session.flush()

    token = secrets.token_urlsafe(32)
    invite = ClientInvite(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="client@example.com",
        token=token,
        invited_by=admin.id,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db_session.add(invite)
    await db_session.commit()

    return {
        "plan": plan,
        "org": org,
        "stage": stage,
        "admin": admin,
        "invite": invite,
        "token": token,
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


async def test_validate_invite(client, seed_data):
    token = seed_data["token"]
    resp = await client.get(f"/api/portal/onboarding/{token}")
    assert resp.status_code == 200
    assert resp.json()["organization_name"] == "Wrap Shop"


async def test_validate_invite_invalid_token(client):
    resp = await client.get("/api/portal/onboarding/invalid-token-xyz")
    assert resp.status_code == 410


async def test_validate_invite_expired(client, seed_data, db_session):
    invite = seed_data["invite"]
    invite.expires_at = datetime.now(UTC) - timedelta(hours=1)
    await db_session.commit()

    resp = await client.get(f"/api/portal/onboarding/{seed_data['token']}")
    assert resp.status_code == 410


async def test_validate_invite_already_used(client, seed_data, db_session):
    invite = seed_data["invite"]
    invite.accepted_at = datetime.now(UTC)
    await db_session.commit()

    resp = await client.get(f"/api/portal/onboarding/{seed_data['token']}")
    assert resp.status_code == 410


@patch(
    "app.routers.onboarding.settings",
)
@patch(
    "app.routers.onboarding.generate_upload_url",
    return_value="https://r2.example.com/signed",
)
@patch(
    "app.routers.onboarding.generate_object_key",
    return_value="org/onboarding/abc_photo.jpg",
)
async def test_get_upload_url(mock_key, mock_url, mock_settings, client, seed_data):
    mock_settings.r2_account_id = "fake-account-id"
    token = seed_data["token"]
    resp = await client.post(
        f"/api/portal/onboarding/{token}/upload-url",
        json={"filename": "photo.jpg", "content_type": "image/jpeg"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["upload_url"] == "https://r2.example.com/signed"
    assert data["r2_key"] == "org/onboarding/abc_photo.jpg"


@patch("app.routers.onboarding.send_magic_link_email", new_callable=AsyncMock)
async def test_submit_onboarding(mock_email, client, seed_data):
    token = seed_data["token"]
    resp = await client.post(
        f"/api/portal/onboarding/{token}/submit",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "phone": "555-1234",
            "company_name": "Doe Fleet",
            "address": "123 Main St",
            "vehicle": {
                "year": 2024,
                "make": "Ford",
                "model": "Transit",
            },
            "job_type": "commercial",
            "project_description": "Full fleet wrap",
            "referral_source": "Google",
            "file_keys": [],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Onboarding complete. Check your email for portal access."
    assert data["job_number"] == "WO-00001"
    assert data["work_order_id"] is not None


@patch("app.routers.onboarding.send_magic_link_email", new_callable=AsyncMock)
async def test_submit_onboarding_already_used(mock_email, client, seed_data):
    token = seed_data["token"]

    # First submit
    await client.post(
        f"/api/portal/onboarding/{token}/submit",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "vehicle": {"year": 2024, "make": "Ford", "model": "Transit"},
            "file_keys": [],
        },
    )

    # Second submit — token now used
    resp = await client.post(
        f"/api/portal/onboarding/{token}/submit",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "vehicle": {"year": 2024, "make": "Ford", "model": "Transit"},
            "file_keys": [],
        },
    )
    assert resp.status_code == 410
