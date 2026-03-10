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

    return {"org": org, "admin": admin, "installer": installer}


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


async def test_invite_creates_user_with_correct_role_and_org(client, seed_data):
    headers = make_token(seed_data["admin"])
    resp = await client.post(
        "/api/admin/users/invite",
        headers=headers,
        json={"email": "newuser@shop.com", "role": "designer"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newuser@shop.com"
    assert data["role"] == "designer"
    assert data["organization_id"] == str(seed_data["org"].id)
    assert data["is_active"] is True
    assert "created_at" in data
    assert "updated_at" in data


async def test_invite_duplicate_email_fails(client, seed_data):
    headers = make_token(seed_data["admin"])
    resp = await client.post(
        "/api/admin/users/invite",
        headers=headers,
        json={"email": "installer@shop.com", "role": "designer"},
    )
    assert resp.status_code == 409
    assert "already registered" in resp.json()["detail"].lower()


async def test_non_admin_cannot_invite(client, seed_data):
    headers = make_token(seed_data["installer"])
    resp = await client.post(
        "/api/admin/users/invite",
        headers=headers,
        json={"email": "newuser@shop.com", "role": "designer"},
    )
    assert resp.status_code == 403


async def test_toggle_user_active(client, seed_data):
    headers = make_token(seed_data["admin"])
    installer_id = seed_data["installer"].id
    resp = await client.patch(
        f"/api/admin/users/{installer_id}/active",
        headers=headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Re-activate
    resp = await client.patch(
        f"/api/admin/users/{installer_id}/active",
        headers=headers,
        json={"is_active": True},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


async def test_toggle_own_active_forbidden(client, seed_data):
    headers = make_token(seed_data["admin"])
    admin_id = seed_data["admin"].id
    resp = await client.patch(
        f"/api/admin/users/{admin_id}/active",
        headers=headers,
        json={"is_active": False},
    )
    assert resp.status_code == 400
