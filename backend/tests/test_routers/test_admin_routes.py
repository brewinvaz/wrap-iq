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
        id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id
    )
    db_session.add(org)
    await db_session.flush()

    other_org = Organization(
        id=uuid.uuid4(), name="Other", slug="other", plan_id=plan.id
    )
    db_session.add(other_org)
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
    other_user = User(
        id=uuid.uuid4(),
        organization_id=other_org.id,
        email="other@other.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add_all([admin, installer, other_user])
    await db_session.commit()

    return {
        "org": org,
        "other_org": other_org,
        "admin": admin,
        "installer": installer,
        "other_user": other_user,
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


async def test_list_users_as_admin(client, seed_data):
    headers = make_token(seed_data["admin"])
    resp = await client.get("/api/admin/users", headers=headers)
    assert resp.status_code == 200
    emails = {u["email"] for u in resp.json()}
    # Should only see users in own org, not other org
    assert "admin@shop.com" in emails
    assert "installer@shop.com" in emails
    assert "other@other.com" not in emails


async def test_list_users_forbidden_for_installer(client, seed_data):
    headers = make_token(seed_data["installer"])
    resp = await client.get("/api/admin/users", headers=headers)
    assert resp.status_code == 403


async def test_update_user_role(client, seed_data):
    headers = make_token(seed_data["admin"])
    installer_id = seed_data["installer"].id
    resp = await client.patch(
        f"/api/admin/users/{installer_id}/role",
        headers=headers,
        json={"role": "project_manager"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "project_manager"


async def test_update_own_role_forbidden(client, seed_data):
    headers = make_token(seed_data["admin"])
    admin_id = seed_data["admin"].id
    resp = await client.patch(
        f"/api/admin/users/{admin_id}/role",
        headers=headers,
        json={"role": "installer"},
    )
    assert resp.status_code == 400


async def test_update_role_cross_org_not_found(client, seed_data):
    headers = make_token(seed_data["admin"])
    other_id = seed_data["other_user"].id
    resp = await client.patch(
        f"/api/admin/users/{other_id}/role",
        headers=headers,
        json={"role": "installer"},
    )
    assert resp.status_code == 404


async def test_deactivate_user(client, seed_data):
    headers = make_token(seed_data["admin"])
    installer_id = seed_data["installer"].id
    resp = await client.delete(
        f"/api/admin/users/{installer_id}",
        headers=headers,
    )
    assert resp.status_code == 204


async def test_deactivate_self_forbidden(client, seed_data):
    headers = make_token(seed_data["admin"])
    admin_id = seed_data["admin"].id
    resp = await client.delete(
        f"/api/admin/users/{admin_id}",
        headers=headers,
    )
    assert resp.status_code == 400


async def test_deactivate_cross_org_not_found(client, seed_data):
    headers = make_token(seed_data["admin"])
    other_id = seed_data["other_user"].id
    resp = await client.delete(
        f"/api/admin/users/{other_id}",
        headers=headers,
    )
    assert resp.status_code == 404
