import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.auth.jwt import create_access_token
from app.main import app
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


@pytest.fixture
async def seed_plan(db_session: AsyncSession):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.commit()
    return plan


@pytest.fixture
async def seed_org(db_session: AsyncSession, seed_plan: Plan):
    org = Organization(
        id=uuid.uuid4(),
        name="Test Shop",
        slug="test-shop",
        plan_id=seed_plan.id,
    )
    db_session.add(org)
    await db_session.commit()
    return org


@pytest.fixture
async def client_user(db_session: AsyncSession, seed_org: Organization):
    user = User(
        id=uuid.uuid4(),
        organization_id=seed_org.id,
        email="client@example.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession, seed_org: Organization):
    user = User(
        id=uuid.uuid4(),
        organization_id=seed_org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _make_token(user: User) -> str:
    return create_access_token(
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
    )


@pytest.fixture
async def client(db_session: AsyncSession):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# --- Client role can access portal endpoints ---


async def test_client_can_list_projects(client, client_user):
    token = _make_token(client_user)
    resp = await client.get(
        "/api/portal/projects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []


async def test_client_can_get_notifications(client, client_user):
    token = _make_token(client_user)
    resp = await client.get(
        "/api/portal/notifications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_client_can_get_unread_count(client, client_user):
    token = _make_token(client_user)
    resp = await client.get(
        "/api/portal/notifications/unread-count",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


async def test_client_project_not_found(client, client_user):
    token = _make_token(client_user)
    fake_id = str(uuid.uuid4())
    resp = await client.get(
        f"/api/portal/projects/{fake_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# --- Non-client roles get 403 ---


async def test_admin_cannot_access_portal_projects(client, admin_user):
    token = _make_token(admin_user)
    resp = await client.get(
        "/api/portal/projects",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_admin_cannot_access_portal_notifications(client, admin_user):
    token = _make_token(admin_user)
    resp = await client.get(
        "/api/portal/notifications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# --- Unauthenticated access gets 401/403 ---


async def test_unauthenticated_cannot_access_projects(client, seed_plan):
    resp = await client.get("/api/portal/projects")
    assert resp.status_code in (401, 403)


async def test_unauthenticated_cannot_access_notifications(client, seed_plan):
    resp = await client.get("/api/portal/notifications")
    assert resp.status_code in (401, 403)


async def test_unauthenticated_cannot_access_unread_count(client, seed_plan):
    resp = await client.get("/api/portal/notifications/unread-count")
    assert resp.status_code in (401, 403)


# --- Magic link request is public (no auth required) ---


async def test_magic_link_request_is_public(client, seed_plan):
    resp = await client.post(
        "/api/portal/magic-link/request",
        json={"email": "nobody@example.com"},
    )
    assert resp.status_code == 200
    assert "magic link" in resp.json()["message"].lower()
