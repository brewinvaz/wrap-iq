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


async def test_register(client):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "new@shop.com", "password": "pass123", "org_name": "New Shop"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_register_duplicate(client):
    await client.post(
        "/api/auth/register",
        json={"email": "dup@shop.com", "password": "pass", "org_name": "Shop"},
    )
    resp = await client.post(
        "/api/auth/register",
        json={"email": "dup@shop.com", "password": "pass", "org_name": "Shop 2"},
    )
    assert resp.status_code == 409


async def test_login(client):
    await client.post(
        "/api/auth/register",
        json={"email": "log@shop.com", "password": "mypass", "org_name": "Log Shop"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "log@shop.com", "password": "mypass"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_login_wrong_password(client):
    await client.post(
        "/api/auth/register",
        json={"email": "bad@shop.com", "password": "right", "org_name": "Bad Shop"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "bad@shop.com", "password": "wrong"},
    )
    assert resp.status_code == 401


async def test_refresh_token(client):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "ref@shop.com", "password": "pass", "org_name": "Ref Shop"},
    )
    refresh = reg.json()["refresh_token"]
    resp = await client.post(
        "/api/auth/token/refresh",
        json={"refresh_token": refresh},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_logout(client):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "out@shop.com", "password": "pass", "org_name": "Out Shop"},
    )
    refresh = reg.json()["refresh_token"]
    resp = await client.post(
        "/api/auth/logout",
        json={"refresh_token": refresh},
    )
    assert resp.status_code == 200

    resp = await client.post(
        "/api/auth/token/refresh",
        json={"refresh_token": refresh},
    )
    assert resp.status_code == 401
