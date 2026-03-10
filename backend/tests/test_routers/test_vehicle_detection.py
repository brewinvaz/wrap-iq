from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.schemas.vehicle_detection import (
    DetectionSuggestion,
    VehicleDetectionResponse,
)


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


def _detection_response(**overrides):
    defaults = {
        "year": 2023,
        "make": "Toyota",
        "model": "Camry",
        "vehicle_type": "car",
        "color": "white",
        "confidence": 0.92,
        "suggestions": [
            DetectionSuggestion(
                year=2022, make="Toyota", model="Camry", confidence=0.75
            )
        ],
    }
    defaults.update(overrides)
    return VehicleDetectionResponse(**defaults)


async def test_detect_vehicle_success(client):
    with patch(
        "app.routers.vehicle_detection.detect_vehicle_from_image",
        new_callable=AsyncMock,
    ) as mock:
        mock.return_value = _detection_response()
        resp = await client.post(
            "/api/vehicles/detect",
            files={"file": ("car.jpg", b"fake-image-data", "image/jpeg")},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["year"] == 2023
    assert data["make"] == "Toyota"
    assert data["model"] == "Camry"
    assert data["vehicle_type"] == "car"
    assert data["color"] == "white"
    assert data["confidence"] == pytest.approx(0.92)
    assert len(data["suggestions"]) == 1


async def test_detect_vehicle_invalid_file_type(client):
    resp = await client.post(
        "/api/vehicles/detect",
        files={"file": ("doc.pdf", b"fake-pdf", "application/pdf")},
    )

    assert resp.status_code == 400
    assert "Invalid file type" in resp.json()["detail"]


async def test_detect_vehicle_file_too_large(client):
    large_data = b"x" * (10 * 1024 * 1024 + 1)
    resp = await client.post(
        "/api/vehicles/detect",
        files={"file": ("big.jpg", large_data, "image/jpeg")},
    )

    assert resp.status_code in (400, 413)
    assert "too large" in resp.json()["detail"].lower()


async def test_detect_vehicle_requires_auth():
    """Without auth override, endpoint should require authentication."""
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post(
            "/api/vehicles/detect",
            files={"file": ("car.jpg", b"fake-image-data", "image/jpeg")},
        )
    assert resp.status_code in (401, 403)


async def test_detect_vehicle_ai_not_configured(client):
    with patch(
        "app.routers.vehicle_detection.detect_vehicle_from_image",
        new_callable=AsyncMock,
    ) as mock:
        mock.side_effect = RuntimeError("AI features are not configured")
        resp = await client.post(
            "/api/vehicles/detect",
            files={"file": ("car.jpg", b"fake-image-data", "image/jpeg")},
        )

    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"].lower()


async def test_detect_vehicle_png(client):
    with patch(
        "app.routers.vehicle_detection.detect_vehicle_from_image",
        new_callable=AsyncMock,
    ) as mock:
        mock.return_value = _detection_response()
        resp = await client.post(
            "/api/vehicles/detect",
            files={"file": ("car.png", b"fake-png-data", "image/png")},
        )

    assert resp.status_code == 200


async def test_detect_vehicle_webp(client):
    with patch(
        "app.routers.vehicle_detection.detect_vehicle_from_image",
        new_callable=AsyncMock,
    ) as mock:
        mock.return_value = _detection_response()
        resp = await client.post(
            "/api/vehicles/detect",
            files={"file": ("car.webp", b"fake-webp-data", "image/webp")},
        )

    assert resp.status_code == 200
