from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.schemas.vin import VehicleInfo, VehicleType


@pytest.fixture
def mock_user():
    user = AsyncMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "user@shop.com"
    user.role = "admin"
    user.organization_id = "00000000-0000-0000-0000-000000000002"
    user.is_active = True
    return user


@pytest.fixture
async def client(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def _vehicle_info(**kwargs):
    defaults = {
        "vin": "1HGBH41JXMN109186",
        "year": 2023,
        "make": "Toyota",
        "model": "Camry",
        "vehicle_type": VehicleType.CAR,
        "raw_body_class": "Sedan",
    }
    defaults.update(kwargs)
    return VehicleInfo(**defaults)


async def test_decode_vin_success(client):
    with patch("app.routers.vin.decode_vin", new_callable=AsyncMock) as mock:
        mock.return_value = _vehicle_info()
        resp = await client.get("/api/vin/1HGBH41JXMN109186")

    assert resp.status_code == 200
    data = resp.json()
    assert data["vin"] == "1HGBH41JXMN109186"
    assert data["year"] == 2023
    assert data["make"] == "Toyota"
    assert data["model"] == "Camry"
    assert data["vehicle_type"] == "Car"


async def test_decode_vin_invalid_format(client):
    resp = await client.get("/api/vin/INVALID")
    assert resp.status_code == 400


async def test_decode_vin_with_ioq_chars(client):
    # VINs cannot contain I, O, or Q
    resp = await client.get("/api/vin/1HGBH41JXMI109186")
    assert resp.status_code == 400


async def test_decode_vin_too_short(client):
    resp = await client.get("/api/vin/1HGBH41JXM")
    assert resp.status_code == 400


async def test_decode_vin_nhtsa_timeout(client):
    with patch("app.routers.vin.decode_vin", new_callable=AsyncMock) as mock:
        mock.side_effect = httpx.TimeoutException("timeout")
        resp = await client.get("/api/vin/1HGBH41JXMN109186")

    assert resp.status_code == 502
    assert "unavailable" in resp.json()["detail"].lower()


async def test_decode_vin_nhtsa_http_error(client):
    with patch("app.routers.vin.decode_vin", new_callable=AsyncMock) as mock:
        mock.side_effect = httpx.HTTPStatusError(
            "error",
            request=httpx.Request("GET", "https://example.com"),
            response=httpx.Response(500),
        )
        resp = await client.get("/api/vin/1HGBH41JXMN109186")

    assert resp.status_code == 502
    assert "error" in resp.json()["detail"].lower()


async def test_decode_vin_nhtsa_connect_error(client):
    with patch("app.routers.vin.decode_vin", new_callable=AsyncMock) as mock:
        mock.side_effect = httpx.ConnectError("connection refused")
        resp = await client.get("/api/vin/1HGBH41JXMN109186")

    assert resp.status_code == 502


async def test_decode_vin_no_results(client):
    with patch("app.routers.vin.decode_vin", new_callable=AsyncMock) as mock:
        mock.side_effect = ValueError("No results returned from NHTSA API")
        resp = await client.get("/api/vin/1HGBH41JXMN109186")

    assert resp.status_code == 502


async def test_decode_vin_requires_auth():
    """Without auth override, endpoint should require authentication."""
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/api/vin/1HGBH41JXMN109186")
    assert resp.status_code in (401, 403)


async def test_decode_vin_pickup_with_truck_fields(client):
    with patch("app.routers.vin.decode_vin", new_callable=AsyncMock) as mock:
        mock.return_value = _vehicle_info(
            vehicle_type=VehicleType.PICKUP,
            truck_cab_size="Crew Cab",
            truck_bed_length="67",
            raw_body_class="Pickup",
        )
        resp = await client.get("/api/vin/1FTFW1E50LFA12345")

    assert resp.status_code == 200
    data = resp.json()
    assert data["vehicle_type"] == "Pickup"
    assert data["truck_cab_size"] == "Crew Cab"
    assert data["truck_bed_length"] == "67"
