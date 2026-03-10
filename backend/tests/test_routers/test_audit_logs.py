import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
from app.models.audit_log import ActionType
from app.models.plan import Plan
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
        json={"email": "admin@shop.com", "password": "pass", "org_name": "My Shop"},
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
