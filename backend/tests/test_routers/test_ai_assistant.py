import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.schemas.ai_assistant import QueryResponse


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


def _query_response(**kwargs):
    defaults = {
        "answer": "You have 3 late jobs.",
        "query_executed": "SELECT * FROM work_orders WHERE organization_id = :org_id",
        "data": [{"job_number": "JOB-001"}],
        "conversation_id": uuid.uuid4(),
    }
    defaults.update(kwargs)
    return QueryResponse(**defaults)


@patch("app.routers.ai_assistant.settings")
@patch("app.routers.ai_assistant.AIAssistantService")
async def test_query_success(mock_service_cls, mock_settings, client):
    mock_settings.gemini_api_key = "test-key"
    mock_service = AsyncMock()
    mock_service.answer_question.return_value = _query_response()
    mock_service_cls.return_value = mock_service

    resp = await client.post(
        "/api/ai/query",
        json={"question": "Which jobs are late?"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "late" in data["answer"].lower()
    assert data["conversation_id"] is not None


@patch("app.routers.ai_assistant.settings")
async def test_query_service_unavailable(mock_settings, client):
    mock_settings.gemini_api_key = ""

    resp = await client.post(
        "/api/ai/query",
        json={"question": "Which jobs are late?"},
    )

    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"].lower()


async def test_query_empty_question(client):
    resp = await client.post(
        "/api/ai/query",
        json={"question": ""},
    )

    assert resp.status_code == 422


async def test_query_requires_auth():
    app.dependency_overrides.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post(
            "/api/ai/query",
            json={"question": "Which jobs are late?"},
        )
    assert resp.status_code in (401, 403)


@patch("app.routers.ai_assistant.settings")
@patch("app.routers.ai_assistant.AIAssistantService")
async def test_query_with_conversation_id(mock_service_cls, mock_settings, client):
    mock_settings.gemini_api_key = "test-key"
    conv_id = uuid.uuid4()
    mock_service = AsyncMock()
    mock_service.answer_question.return_value = _query_response(conversation_id=conv_id)
    mock_service_cls.return_value = mock_service

    resp = await client.post(
        "/api/ai/query",
        json={"question": "Tell me more", "conversation_id": str(conv_id)},
    )

    assert resp.status_code == 200
    assert resp.json()["conversation_id"] == str(conv_id)


@patch("app.routers.ai_assistant.settings")
@patch("app.routers.ai_assistant.AIAssistantService")
async def test_query_service_error(mock_service_cls, mock_settings, client):
    mock_settings.gemini_api_key = "test-key"
    mock_service = AsyncMock()
    mock_service.answer_question.side_effect = Exception("API error")
    mock_service_cls.return_value = mock_service

    resp = await client.post(
        "/api/ai/query",
        json={"question": "Which jobs are late?"},
    )

    assert resp.status_code == 500
