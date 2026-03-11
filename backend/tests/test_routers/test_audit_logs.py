import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.auth.jwt import create_access_token
from app.main import app
from app.models.audit_log import ActionType
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User
from app.services.audit_log import AuditLogService


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


async def _register_and_get_token(client):
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "TestPass123",
            "org_name": "My Shop",
        },
    )
    return resp.json()["access_token"]


async def test_list_audit_logs_requires_auth(client):
    resp = await client.get("/api/audit-logs")
    assert resp.status_code == 401


async def test_list_audit_logs_empty(client):
    token = await _register_and_get_token(client)
    resp = await client.get(
        "/api/audit-logs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_audit_logs_with_data(client, db_session):
    token = await _register_and_get_token(client)

    # Get user's org_id from the me endpoint
    me_resp = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = uuid.UUID(me_resp.json()["organization_id"])
    user_id = uuid.UUID(me_resp.json()["id"])

    # Create some audit logs directly via service
    service = AuditLogService(db_session)
    await service.create_log(
        organization_id=org_id,
        user_id=user_id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
        details={"job_number": "WO-1001"},
    )
    await service.create_log(
        organization_id=org_id,
        user_id=user_id,
        action=ActionType.USER_CREATED,
        resource_type="user",
        resource_id=uuid.uuid4(),
    )
    await db_session.commit()

    resp = await client.get(
        "/api/audit-logs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_list_audit_logs_filter_by_action(client, db_session):
    token = await _register_and_get_token(client)

    me_resp = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = uuid.UUID(me_resp.json()["organization_id"])
    user_id = uuid.UUID(me_resp.json()["id"])

    service = AuditLogService(db_session)
    await service.create_log(
        organization_id=org_id,
        user_id=user_id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
    )
    await service.create_log(
        organization_id=org_id,
        user_id=user_id,
        action=ActionType.USER_CREATED,
        resource_type="user",
        resource_id=uuid.uuid4(),
    )
    await db_session.commit()

    resp = await client.get(
        "/api/audit-logs?action=project_created",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["action"] == "project_created"


async def test_list_audit_logs_filter_by_resource_type(client, db_session):
    token = await _register_and_get_token(client)

    me_resp = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = uuid.UUID(me_resp.json()["organization_id"])
    user_id = uuid.UUID(me_resp.json()["id"])

    service = AuditLogService(db_session)
    await service.create_log(
        organization_id=org_id,
        user_id=user_id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
    )
    await service.create_log(
        organization_id=org_id,
        user_id=user_id,
        action=ActionType.USER_CREATED,
        resource_type="user",
        resource_id=uuid.uuid4(),
    )
    await db_session.commit()

    resp = await client.get(
        "/api/audit-logs?resource_type=user",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["resource_type"] == "user"


async def test_list_audit_logs_pagination(client, db_session):
    token = await _register_and_get_token(client)

    me_resp = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = uuid.UUID(me_resp.json()["organization_id"])
    user_id = uuid.UUID(me_resp.json()["id"])

    service = AuditLogService(db_session)
    for i in range(5):
        await service.create_log(
            organization_id=org_id,
            user_id=user_id,
            action=ActionType.PROJECT_UPDATED,
            resource_type="work_order",
            resource_id=uuid.uuid4(),
        )
    await db_session.commit()

    resp = await client.get(
        "/api/audit-logs?limit=2&offset=0",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["limit"] == 2
    assert data["offset"] == 0


# --- Access control tests for user_id filter ---


@pytest.fixture
async def seed_org_with_users(db_session):
    """Create an org with an admin and an installer user directly."""
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)

    org = Organization(
        id=uuid.uuid4(),
        name="Test Shop",
        slug="test-shop",
        plan_id=plan.id,
    )
    db_session.add(org)

    admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@testshop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    installer = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="installer@testshop.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add_all([admin, installer])
    await db_session.commit()

    return {"org": org, "admin": admin, "installer": installer}


def _make_token(user: User) -> dict:
    token = create_access_token(
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def acl_client(db_session, seed_org_with_users):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def test_non_admin_cannot_query_other_users_logs(
    acl_client, db_session, seed_org_with_users
):
    """Non-admin user passing another user's ID should only see own logs."""
    data = seed_org_with_users
    admin = data["admin"]
    installer = data["installer"]

    service = AuditLogService(db_session)
    # Create logs for both users
    await service.create_log(
        organization_id=data["org"].id,
        user_id=admin.id,
        action=ActionType.USER_CREATED,
        resource_type="user",
        resource_id=uuid.uuid4(),
    )
    await service.create_log(
        organization_id=data["org"].id,
        user_id=installer.id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
    )
    await db_session.commit()

    # Installer tries to query admin's logs — should get only own logs
    headers = _make_token(installer)
    resp = await acl_client.get(
        f"/api/audit-logs?user_id={admin.id}",
        headers=headers,
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["total"] == 1
    assert result["items"][0]["user_id"] == str(installer.id)


async def test_admin_can_query_other_users_logs(
    acl_client, db_session, seed_org_with_users
):
    """Admin user can filter by any user_id."""
    data = seed_org_with_users
    admin = data["admin"]
    installer = data["installer"]

    service = AuditLogService(db_session)
    await service.create_log(
        organization_id=data["org"].id,
        user_id=installer.id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
    )
    await db_session.commit()

    headers = _make_token(admin)
    resp = await acl_client.get(
        f"/api/audit-logs?user_id={installer.id}",
        headers=headers,
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["total"] == 1
    assert result["items"][0]["user_id"] == str(installer.id)


async def test_non_admin_without_user_id_sees_only_own_logs(
    acl_client, db_session, seed_org_with_users
):
    """Non-admin with no user_id param sees only their own logs."""
    data = seed_org_with_users
    admin = data["admin"]
    installer = data["installer"]

    service = AuditLogService(db_session)
    await service.create_log(
        organization_id=data["org"].id,
        user_id=admin.id,
        action=ActionType.USER_CREATED,
        resource_type="user",
        resource_id=uuid.uuid4(),
    )
    await service.create_log(
        organization_id=data["org"].id,
        user_id=installer.id,
        action=ActionType.PROJECT_CREATED,
        resource_type="work_order",
        resource_id=uuid.uuid4(),
    )
    await db_session.commit()

    headers = _make_token(installer)
    resp = await acl_client.get("/api/audit-logs", headers=headers)
    assert resp.status_code == 200
    result = resp.json()
    # Installer should only see their own log, not the admin's
    assert result["total"] == 1
    assert result["items"][0]["user_id"] == str(installer.id)
