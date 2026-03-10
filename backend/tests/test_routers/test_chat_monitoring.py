import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.schemas.chat_monitoring import (
    ApplyUpdateResponse,
    ChatAnalysisResponse,
    SuggestedUpdate,
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


def _analysis_response(**kwargs):
    defaults = {
        "message_relevant": True,
        "suggested_updates": [
            SuggestedUpdate(
                work_order_id=uuid.uuid4(),
                work_order_job_number="JOB-001",
                field_to_update="internal_notes",
                suggested_value="Customer confirmed Friday delivery",
                reason="Message mentions JOB-001",
                confidence=0.85,
            )
        ],
        "raw_analysis": None,
    }
    defaults.update(kwargs)
    return ChatAnalysisResponse(**defaults)


@patch("app.routers.chat_monitoring.settings")
@patch("app.routers.chat_monitoring.ChatMonitoringService")
async def test_analyze_success(mock_service_cls, mock_settings, client):
    mock_settings.gemini_api_key = "test-key"
    mock_service = AsyncMock()
    mock_service.analyze_message.return_value = _analysis_response()
    mock_service_cls.return_value = mock_service

    resp = await client.post(
        "/api/ai/chat/analyze",
        json={"text": "JOB-001 delivery confirmed", "author": "John"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["message_relevant"] is True
    assert len(data["suggested_updates"]) == 1


@patch("app.routers.chat_monitoring.settings")
@patch("app.routers.chat_monitoring.ChatMonitoringService")
async def test_apply_success(mock_service_cls, mock_settings, client):
    mock_settings.gemini_api_key = "test-key"
    mock_service = AsyncMock()
    mock_service.apply_update.return_value = ApplyUpdateResponse(
        success=True,
        message="Successfully updated 'internal_notes' on work order JOB-001.",
    )
    mock_service_cls.return_value = mock_service

    resp = await client.post(
        "/api/ai/chat/apply",
        json={
            "work_order_id": str(uuid.uuid4()),
            "field_to_update": "internal_notes",
            "value": "Customer confirmed delivery",
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True


@patch("app.routers.chat_monitoring.settings")
async def test_analyze_service_unavailable(mock_settings, client):
    mock_settings.gemini_api_key = ""

    resp = await client.post(
        "/api/ai/chat/analyze",
        json={"text": "JOB-001 update", "author": "John"},
    )

    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"].lower()


@patch("app.routers.chat_monitoring.settings")
async def test_apply_service_unavailable(mock_settings, client):
    mock_settings.gemini_api_key = ""

    resp = await client.post(
        "/api/ai/chat/apply",
        json={
            "work_order_id": str(uuid.uuid4()),
            "field_to_update": "internal_notes",
            "value": "test",
        },
    )

    assert resp.status_code == 503


async def test_analyze_requires_auth():
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post(
            "/api/ai/chat/analyze",
            json={"text": "test message", "author": "John"},
        )
    assert resp.status_code in (401, 403)


async def test_apply_requires_auth():
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post(
            "/api/ai/chat/apply",
            json={
                "work_order_id": str(uuid.uuid4()),
                "field_to_update": "internal_notes",
                "value": "test",
            },
        )
    assert resp.status_code in (401, 403)


async def test_analyze_empty_message(client):
    resp = await client.post(
        "/api/ai/chat/analyze",
        json={"text": "", "author": "John"},
    )

    assert resp.status_code == 422


async def test_apply_invalid_field(client):
    resp = await client.post(
        "/api/ai/chat/apply",
        json={
            "work_order_id": str(uuid.uuid4()),
            "field_to_update": "job_value",
            "value": "9999",
        },
    )

    assert resp.status_code == 422


@patch("app.routers.chat_monitoring.settings")
@patch("app.routers.chat_monitoring.ChatMonitoringService")
async def test_analyze_service_error(mock_service_cls, mock_settings, client):
    mock_settings.gemini_api_key = "test-key"
    mock_service = AsyncMock()
    mock_service.analyze_message.side_effect = Exception("API error")
    mock_service_cls.return_value = mock_service

    resp = await client.post(
        "/api/ai/chat/analyze",
        json={"text": "JOB-001 update", "author": "John"},
    )

    assert resp.status_code == 500


@patch("app.routers.chat_monitoring.settings")
@patch("app.routers.chat_monitoring.ChatMonitoringService")
async def test_apply_service_error(mock_service_cls, mock_settings, client):
    mock_settings.gemini_api_key = "test-key"
    mock_service = AsyncMock()
    mock_service.apply_update.side_effect = Exception("DB error")
    mock_service_cls.return_value = mock_service

    resp = await client.post(
        "/api/ai/chat/apply",
        json={
            "work_order_id": str(uuid.uuid4()),
            "field_to_update": "internal_notes",
            "value": "test",
        },
    )

    assert resp.status_code == 500
