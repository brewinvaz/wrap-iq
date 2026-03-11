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

    superadmin = User(
        id=uuid.uuid4(),
        organization_id=None,
        email="sa@wrapflow.io",
        password_hash="hashed",
        role=Role.ADMIN,
        is_superadmin=True,
    )
    regular_admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
        is_superadmin=False,
    )
    installer = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="installer@shop.com",
        password_hash="hashed",
        role=Role.INSTALLER,
        is_superadmin=False,
    )
    db_session.add_all([superadmin, regular_admin, installer])
    await db_session.commit()

    return {
        "plan": plan,
        "org": org,
        "superadmin": superadmin,
        "regular_admin": regular_admin,
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


def make_token(user: User, **kwargs) -> dict:
    token = create_access_token(
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
        is_superadmin=user.is_superadmin,
        **kwargs,
    )
    return {"Authorization": f"Bearer {token}"}


# ── Auth guard tests ─────────────────────────────────────────────────


async def test_non_superadmin_gets_403(client, seed_data):
    headers = make_token(seed_data["regular_admin"])
    resp = await client.get("/api/superadmin/orgs", headers=headers)
    assert resp.status_code == 403


async def test_unauthenticated_gets_401(client):
    resp = await client.get("/api/superadmin/orgs")
    assert resp.status_code in (401, 403)


# ── Org endpoints ────────────────────────────────────────────────────


async def test_list_orgs(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get("/api/superadmin/orgs", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Shop"


async def test_list_orgs_search(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get(
        "/api/superadmin/orgs", headers=headers, params={"search": "Shop"}
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.get(
        "/api/superadmin/orgs", headers=headers, params={"search": "Nonexistent"}
    )
    assert resp.json()["total"] == 0


async def test_get_org_detail(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.get(f"/api/superadmin/orgs/{org_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Shop"
    assert data["user_count"] == 2  # regular_admin + installer
    assert data["work_order_count"] == 0


async def test_get_org_detail_not_found(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get(f"/api/superadmin/orgs/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


async def test_create_org(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    plan_id = seed_data["plan"].id
    resp = await client.post(
        "/api/superadmin/orgs",
        headers=headers,
        json={"name": "New Org", "plan_id": str(plan_id)},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "New Org"


async def test_update_org(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.patch(
        f"/api/superadmin/orgs/{org_id}",
        headers=headers,
        json={"name": "Renamed Shop", "is_active": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Renamed Shop"
    assert data["is_active"] is False


async def test_update_org_not_found(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.patch(
        f"/api/superadmin/orgs/{uuid.uuid4()}",
        headers=headers,
        json={"name": "X"},
    )
    assert resp.status_code == 404


# ── User endpoints ───────────────────────────────────────────────────


async def test_list_users(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get("/api/superadmin/users", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3  # superadmin + regular_admin + installer


async def test_list_users_filter_by_org(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.get(
        "/api/superadmin/users",
        headers=headers,
        params={"organization_id": str(org_id)},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


async def test_list_users_filter_by_role(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get(
        "/api/superadmin/users",
        headers=headers,
        params={"role": "installer"},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_get_user_detail(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    user_id = seed_data["regular_admin"].id
    resp = await client.get(f"/api/superadmin/users/{user_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@shop.com"


async def test_get_user_not_found(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get(f"/api/superadmin/users/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


async def test_update_user(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    user_id = seed_data["installer"].id
    resp = await client.patch(
        f"/api/superadmin/users/{user_id}",
        headers=headers,
        json={"role": "project_manager", "is_active": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "project_manager"
    assert data["is_active"] is False


async def test_update_user_not_found(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.patch(
        f"/api/superadmin/users/{uuid.uuid4()}",
        headers=headers,
        json={"role": "admin"},
    )
    assert resp.status_code == 404


async def test_create_superadmin_user(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.post(
        "/api/superadmin/users",
        headers=headers,
        json={
            "email": "new-sa@wrapflow.io",
            "password": "Secure123",
            "is_superadmin": True,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_superadmin"] is True
    assert data["organization_id"] is None


async def test_create_superadmin_user_duplicate_email(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.post(
        "/api/superadmin/users",
        headers=headers,
        json={
            "email": "sa@wrapflow.io",
            "password": "TestPass123",
            "is_superadmin": True,
        },
    )
    assert resp.status_code == 409


# ── Metrics endpoint ─────────────────────────────────────────────────


async def test_get_metrics(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get("/api/superadmin/metrics", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_organizations"] == 1
    assert data["total_users"] == 3
    assert data["total_work_orders"] == 0
    assert isinstance(data["orgs_by_plan"], list)
    assert isinstance(data["recent_signups"], list)


# ── Audit logs endpoint ─────────────────────────────────────────────


async def test_list_audit_logs_empty(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get("/api/superadmin/audit-logs", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


# ── Impersonation endpoints ─────────────────────────────────────────


async def test_start_impersonation(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.post(f"/api/superadmin/impersonate/{org_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["impersonating"] is True
    assert data["organization_id"] == str(org_id)
    assert "access_token" in data


async def test_start_impersonation_nonexistent_org(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.post(
        f"/api/superadmin/impersonate/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


async def test_start_impersonation_inactive_org(client, seed_data, db_session):
    headers = make_token(seed_data["superadmin"])
    # Deactivate the org
    org = seed_data["org"]
    org.is_active = False
    await db_session.commit()

    resp = await client.post(f"/api/superadmin/impersonate/{org.id}", headers=headers)
    assert resp.status_code == 404


async def test_stop_impersonation(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.post("/api/superadmin/stop-impersonation", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["impersonating"] is False
    assert "access_token" in data


async def test_impersonation_token_has_correct_claims(client, seed_data):
    from app.auth.jwt import decode_token

    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.post(f"/api/superadmin/impersonate/{org_id}", headers=headers)
    assert resp.status_code == 200

    token = resp.json()["access_token"]
    payload = decode_token(token)
    assert payload["is_superadmin"] is True
    assert payload["impersonating"] is True
    assert payload["org"] == str(org_id)
    assert payload["real_user_id"] == str(seed_data["superadmin"].id)
    assert payload["role"] == "admin"
