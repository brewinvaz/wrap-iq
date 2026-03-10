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

    org = Organization(
        id=uuid.uuid4(), name="Test Shop", slug="test-shop", plan_id=plan.id
    )
    db_session.add(org)
    await db_session.flush()

    admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@testshop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(admin)
    await db_session.commit()

    return {"plan": plan, "org": org, "admin": admin}


@pytest.fixture
async def client(db_session, seed_data):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def auth_headers(user: User) -> dict:
    token = create_access_token(
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
    )
    return {"Authorization": f"Bearer {token}"}


async def test_create_client_invite(client, seed_data):
    headers = auth_headers(seed_data["admin"])
    resp = await client.post(
        "/api/admin/client-invites",
        headers=headers,
        json={"email": "newclient@example.com"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newclient@example.com"
    assert data["token"] is not None
    assert data["accepted_at"] is None


async def test_list_client_invites(client, seed_data):
    headers = auth_headers(seed_data["admin"])

    await client.post(
        "/api/admin/client-invites",
        headers=headers,
        json={"email": "a@example.com"},
    )
    await client.post(
        "/api/admin/client-invites",
        headers=headers,
        json={"email": "b@example.com"},
    )

    resp = await client.get("/api/admin/client-invites", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_non_admin_cannot_invite(client, seed_data, db_session):
    installer = User(
        id=uuid.uuid4(),
        organization_id=seed_data["org"].id,
        email="installer@testshop.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add(installer)
    await db_session.commit()

    headers = auth_headers(installer)
    resp = await client.post(
        "/api/admin/client-invites",
        headers=headers,
        json={"email": "c@example.com"},
    )
    assert resp.status_code == 403
