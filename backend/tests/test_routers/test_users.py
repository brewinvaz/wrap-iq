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


async def test_get_me(client):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "me@shop.com", "password": "Testpass123", "org_name": "My Shop"},
    )
    token = reg.json()["access_token"]
    resp = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@shop.com"
    assert data["role"] == "admin"
    assert data["is_superadmin"] is False


async def test_get_me_no_token(client):
    resp = await client.get("/api/users/me")
    assert resp.status_code == 401
