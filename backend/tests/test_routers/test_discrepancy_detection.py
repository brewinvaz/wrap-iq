import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_user, get_session
from app.main import app
from app.schemas.discrepancy_detection import (
    Discrepancy,
    DiscrepancyCheckResponse,
    Severity,
)

VEHICLE_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def mock_user():
    user = AsyncMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "user@shop.com"
    user.role = "admin"
    user.organization_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    user.is_active = True
    return user


@pytest.fixture
def mock_session():
    session = AsyncMock()
    return session


@pytest.fixture
async def client(mock_user, mock_session):
    app.dependency_overrides[get_current_user] = lambda: mock_user

    async def override_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def _success_response(**overrides):
    defaults = {
        "discrepancies": [],
        "match_confidence": 0.95,
        "image_analysis_summary": "White Toyota Camry sedan",
    }
    defaults.update(overrides)
    return DiscrepancyCheckResponse(**defaults)


async def test_discrepancy_check_success(client):
    with patch(
        "app.routers.discrepancy_detection.detect_discrepancies",
        new_callable=AsyncMock,
    ) as mock:
        mock.return_value = _success_response()
        resp = await client.post(
            f"/api/vehicles/discrepancy-check?vehicle_id={VEHICLE_ID}",
            files={"file": ("car.jpg", b"fake-image-data", "image/jpeg")},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["match_confidence"] == pytest.approx(0.95)
    assert data["discrepancies"] == []
    assert data["image_analysis_summary"] == "White Toyota Camry sedan"


async def test_discrepancy_check_with_discrepancies(client):
    response = _success_response(
        match_confidence=0.3,
        discrepancies=[
            Discrepancy(
                field="make",
                expected="Toyota",
                detected="Honda",
                severity=Severity.HIGH,
            )
        ],
    )
    with patch(
        "app.routers.discrepancy_detection.detect_discrepancies",
        new_callable=AsyncMock,
    ) as mock:
        mock.return_value = response
        resp = await client.post(
            f"/api/vehicles/discrepancy-check?vehicle_id={VEHICLE_ID}",
            files={"file": ("car.jpg", b"fake-image-data", "image/jpeg")},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["discrepancies"]) == 1
    assert data["discrepancies"][0]["field"] == "make"
    assert data["discrepancies"][0]["severity"] == "high"


async def test_discrepancy_check_service_unavailable(client):
    with patch(
        "app.routers.discrepancy_detection.detect_discrepancies",
        new_callable=AsyncMock,
    ) as mock:
        mock.side_effect = RuntimeError("AI features are not configured")
        resp = await client.post(
            f"/api/vehicles/discrepancy-check?vehicle_id={VEHICLE_ID}",
            files={"file": ("car.jpg", b"fake-image-data", "image/jpeg")},
        )

    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"].lower()


async def test_discrepancy_check_invalid_file_type(client):
    resp = await client.post(
        f"/api/vehicles/discrepancy-check?vehicle_id={VEHICLE_ID}",
        files={"file": ("doc.pdf", b"fake-pdf", "application/pdf")},
    )

    assert resp.status_code == 400
    assert "Invalid file type" in resp.json()["detail"]


async def test_discrepancy_check_requires_auth():
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post(
            f"/api/vehicles/discrepancy-check?vehicle_id={VEHICLE_ID}",
            files={"file": ("car.jpg", b"fake-image-data", "image/jpeg")},
        )
    assert resp.status_code in (401, 403)


async def test_discrepancy_check_vehicle_not_found(client):
    with patch(
        "app.routers.discrepancy_detection.detect_discrepancies",
        new_callable=AsyncMock,
    ) as mock:
        mock.side_effect = LookupError("Vehicle not found")
        resp = await client.post(
            f"/api/vehicles/discrepancy-check?vehicle_id={VEHICLE_ID}",
            files={"file": ("car.jpg", b"fake-image-data", "image/jpeg")},
        )

    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()
