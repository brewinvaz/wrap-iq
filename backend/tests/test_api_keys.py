import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
from app.models.plan import Plan
from app.services.api_key_service import APIKeyService


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


async def test_list_api_keys_requires_auth(client):
    resp = await client.get("/api/api-keys")
    assert resp.status_code == 401


async def test_create_api_key(client):
    token = await _register_and_get_token(client)
    resp = await client.post(
        "/api/api-keys",
        json={
            "name": "Test Key",
            "scopes": ["projects:read", "clients:read"],
            "rate_limit_per_minute": 100,
            "rate_limit_per_day": 5000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Key"
    assert "full_key" in data
    assert data["full_key"].startswith("wiq_")
    assert data["key_prefix"] == data["full_key"][:8]
    assert data["scopes"] == ["projects:read", "clients:read"]
    assert data["is_active"] is True
    assert data["rate_limit_per_minute"] == 100
    assert data["rate_limit_per_day"] == 5000


async def test_create_api_key_invalid_scopes(client):
    token = await _register_and_get_token(client)
    resp = await client.post(
        "/api/api-keys",
        json={
            "name": "Bad Key",
            "scopes": ["invalid:scope"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "Invalid scopes" in resp.json()["detail"]


async def test_list_api_keys_empty(client):
    token = await _register_and_get_token(client)
    resp = await client.get(
        "/api/api-keys",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_api_keys_with_data(client):
    token = await _register_and_get_token(client)

    # Create two keys
    await client.post(
        "/api/api-keys",
        json={"name": "Key 1", "scopes": ["projects:read"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/api-keys",
        json={"name": "Key 2", "scopes": ["clients:read"]},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/api-keys",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    # full_key should not be in list response
    for item in data["items"]:
        assert "full_key" not in item


async def test_get_api_key_detail(client):
    token = await _register_and_get_token(client)

    create_resp = await client.post(
        "/api/api-keys",
        json={"name": "Detail Key", "scopes": ["projects:read"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    key_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/api-keys/{key_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Detail Key"
    assert "full_key" not in data


async def test_get_api_key_not_found(client):
    token = await _register_and_get_token(client)
    resp = await client.get(
        f"/api/api-keys/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_revoke_api_key(client):
    token = await _register_and_get_token(client)

    create_resp = await client.post(
        "/api/api-keys",
        json={"name": "Revoke Me", "scopes": ["projects:read"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    key_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/api-keys/{key_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "API key revoked"

    # Verify it's revoked
    detail_resp = await client.get(
        f"/api/api-keys/{key_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp.json()["is_active"] is False
    assert detail_resp.json()["revoked_at"] is not None


async def test_rotate_api_key(client):
    token = await _register_and_get_token(client)

    create_resp = await client.post(
        "/api/api-keys",
        json={
            "name": "Rotate Me",
            "scopes": ["projects:read", "clients:write"],
            "rate_limit_per_minute": 200,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    old_key_id = create_resp.json()["id"]
    old_full_key = create_resp.json()["full_key"]

    resp = await client.post(
        f"/api/api-keys/{old_key_id}/rotate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "full_key" in data
    assert data["full_key"] != old_full_key
    assert data["scopes"] == ["projects:read", "clients:write"]
    assert data["rate_limit_per_minute"] == 200

    # Old key should be revoked
    old_resp = await client.get(
        f"/api/api-keys/{old_key_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert old_resp.json()["is_active"] is False


async def test_get_usage_stats(client):
    token = await _register_and_get_token(client)

    create_resp = await client.post(
        "/api/api-keys",
        json={"name": "Usage Key", "scopes": ["projects:read"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    key_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/api-keys/{key_id}/usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_requests"] == 0
    assert data["requests_today"] == 0
    assert "avg_response_time" in data
    assert "top_endpoints" in data


async def test_list_scopes(client):
    token = await _register_and_get_token(client)
    resp = await client.get(
        "/api/api-keys/scopes",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["scopes"]) == 10
    scope_names = [s["scope"] for s in data["scopes"]]
    assert "projects:read" in scope_names
    assert "webhooks:manage" in scope_names


async def test_key_generation_format(db_session):
    service = APIKeyService(db_session)
    raw_key = service._generate_raw_key()
    assert raw_key.startswith("wiq_")
    assert len(raw_key) > 20


async def test_key_hashing_validation(db_session):
    service = APIKeyService(db_session)
    raw_key = service._generate_raw_key()
    key_hash = service._hash_key(raw_key)
    assert len(key_hash) == 64  # SHA-256 hex digest
    assert service._hash_key(raw_key) == key_hash  # deterministic
    assert service._hash_key("different_key") != key_hash
