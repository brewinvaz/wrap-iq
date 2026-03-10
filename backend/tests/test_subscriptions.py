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
async def seed_plans(db_session, seed_plan):
    """Seed multiple plans for comparison tests."""
    starter = Plan(
        id=uuid.uuid4(),
        name="Starter",
        price_cents=4900,
        features={"max_seats": 5, "max_storage_gb": 10},
    )
    pro = Plan(
        id=uuid.uuid4(),
        name="Professional",
        price_cents=9900,
        features={"max_seats": 20, "max_storage_gb": 50},
    )
    db_session.add_all([starter, pro])
    await db_session.commit()
    return [seed_plan, starter, pro]


@pytest.fixture
async def client(db_session, seed_plan):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def plans_client(db_session, seed_plans):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, seed_plans
    app.dependency_overrides.clear()


async def _register_user(client, email="admin@shop.com"):
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "pass", "org_name": "My Shop"},
    )
    return resp.json()["access_token"]


async def test_list_plans(client):
    token = await _register_user(client)
    resp = await client.get(
        "/api/subscriptions/plans",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["name"] == "Free"


async def test_get_current_subscription_none(client):
    token = await _register_user(client)
    resp = await client.get(
        "/api/subscriptions/current",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    # No subscription yet
    assert resp.json() is None


async def test_create_subscription(client, seed_plan):
    token = await _register_user(client)
    resp = await client.post(
        "/api/subscriptions",
        json={"plan_id": str(seed_plan.id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["plan_id"] == str(seed_plan.id)
    assert data["status"] == "active"
    assert data["cancel_at_period_end"] is False


async def test_update_subscription(plans_client):
    client, plans = plans_client
    token = await _register_user(client)

    # Create with Free plan
    await client.post(
        "/api/subscriptions",
        json={"plan_id": str(plans[0].id)},
        headers={"Authorization": f"Bearer {token}"},
    )

    # Update to Starter
    resp = await client.post(
        "/api/subscriptions",
        json={"plan_id": str(plans[1].id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["plan_id"] == str(plans[1].id)


async def test_cancel_subscription(client, seed_plan):
    token = await _register_user(client)

    # Create subscription first
    await client.post(
        "/api/subscriptions",
        json={"plan_id": str(seed_plan.id)},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.post(
        "/api/subscriptions/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["cancel_at_period_end"] is True
    assert resp.json()["status"] == "canceled"


async def test_cancel_subscription_not_found(client):
    token = await _register_user(client)
    resp = await client.post(
        "/api/subscriptions/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_payment_methods_empty(client):
    token = await _register_user(client)
    resp = await client.get(
        "/api/subscriptions/payment-methods",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_add_payment_method(client):
    token = await _register_user(client)
    resp = await client.post(
        "/api/subscriptions/payment-methods",
        json={
            "type": "card",
            "last_four": "4242",
            "brand": "Visa",
            "exp_month": 12,
            "exp_year": 2027,
            "is_default": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["last_four"] == "4242"
    assert data["brand"] == "Visa"
    assert data["is_default"] is True


async def test_remove_payment_method(client):
    token = await _register_user(client)
    create_resp = await client.post(
        "/api/subscriptions/payment-methods",
        json={"type": "card", "last_four": "1234", "brand": "MC"},
        headers={"Authorization": f"Bearer {token}"},
    )
    pm_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/subscriptions/payment-methods/{pm_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    # Verify it's gone
    list_resp = await client.get(
        "/api/subscriptions/payment-methods",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.json() == []


async def test_remove_payment_method_not_found(client):
    token = await _register_user(client)
    fake_id = str(uuid.uuid4())
    resp = await client.delete(
        f"/api/subscriptions/payment-methods/{fake_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_set_default_payment_method(client):
    token = await _register_user(client)

    # Add two payment methods
    await client.post(
        "/api/subscriptions/payment-methods",
        json={"type": "card", "last_four": "1111", "brand": "Visa", "is_default": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    r2 = await client.post(
        "/api/subscriptions/payment-methods",
        json={"type": "card", "last_four": "2222", "brand": "MC"},
        headers={"Authorization": f"Bearer {token}"},
    )
    pm2_id = r2.json()["id"]

    # Set second as default
    resp = await client.put(
        f"/api/subscriptions/payment-methods/{pm2_id}/default",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_default"] is True

    # Verify first is no longer default
    list_resp = await client.get(
        "/api/subscriptions/payment-methods",
        headers={"Authorization": f"Bearer {token}"},
    )
    methods = list_resp.json()
    defaults = [m for m in methods if m["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["last_four"] == "2222"


async def test_usage_metrics(client):
    token = await _register_user(client)
    resp = await client.get(
        "/api/subscriptions/usage",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "seats_used" in data
    assert "seats_limit" in data
    assert "storage_used_gb" in data
    assert "storage_limit_gb" in data
    assert "projects_count" in data
    assert data["seats_used"] >= 1  # at least the registered user


async def test_subscriptions_require_auth(client):
    resp = await client.get("/api/subscriptions/plans")
    assert resp.status_code in (401, 403)
