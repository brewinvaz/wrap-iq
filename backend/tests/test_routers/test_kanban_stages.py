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


async def _register_user(client, email="admin@shop.com"):
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "TestPass123", "org_name": "My Shop"},
    )
    return resp.json()["access_token"]


async def test_list_stages_seeds_defaults(client):
    token = await _register_user(client)
    resp = await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 8
    assert data[0]["name"] == "Lead"
    assert data[-1]["name"] == "Cancelled"


async def test_create_stage(client):
    token = await _register_user(client)
    resp = await client.post(
        "/api/kanban-stages",
        json={"name": "Custom Stage", "color": "#abcdef", "position": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Custom Stage"
    assert data["color"] == "#abcdef"
    assert data["position"] == 10
    assert data["system_status"] is None


async def test_update_stage(client):
    token = await _register_user(client)

    # Create a stage first
    create_resp = await client.post(
        "/api/kanban-stages",
        json={"name": "Old Name", "color": "#000000", "position": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    stage_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/kanban-stages/{stage_id}",
        json={"name": "New Name", "color": "#ffffff"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["color"] == "#ffffff"


async def test_update_stage_not_found(client):
    token = await _register_user(client)
    fake_id = str(uuid.uuid4())
    resp = await client.patch(
        f"/api/kanban-stages/{fake_id}",
        json={"name": "Nope"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_delete_stage(client):
    token = await _register_user(client)

    # Create a custom stage (no system_status)
    create_resp = await client.post(
        "/api/kanban-stages",
        json={"name": "Deletable", "position": 99},
        headers={"Authorization": f"Bearer {token}"},
    )
    stage_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/kanban-stages/{stage_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204


async def test_delete_system_stage_fails(client):
    token = await _register_user(client)

    # Create a stage with system status
    create_resp = await client.post(
        "/api/kanban-stages",
        json={"name": "Lead", "system_status": "lead", "position": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    stage_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/kanban-stages/{stage_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


async def test_delete_stage_not_found(client):
    token = await _register_user(client)
    fake_id = str(uuid.uuid4())
    resp = await client.delete(
        f"/api/kanban-stages/{fake_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_reorder_stages(client):
    token = await _register_user(client)

    # Create two stages
    r1 = await client.post(
        "/api/kanban-stages",
        json={"name": "A", "position": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    r2 = await client.post(
        "/api/kanban-stages",
        json={"name": "B", "position": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]

    resp = await client.post(
        "/api/kanban-stages/reorder",
        json={
            "stages": [
                {"id": id1, "position": 1},
                {"id": id2, "position": 0},
            ]
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data[0]["name"] == "B"
    assert data[1]["name"] == "A"


async def test_kanban_stages_require_auth(client):
    resp = await client.get("/api/kanban-stages")
    assert resp.status_code in (401, 403)
