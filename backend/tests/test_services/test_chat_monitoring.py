import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.chat_monitoring import (
    ApplyUpdateRequest,
    ChatMessage,
)
from app.services.chat_monitoring import ChatMonitoringService, _parse_analysis_response


def _mock_user(org_id=None):
    user = MagicMock()
    user.organization_id = org_id or uuid.uuid4()
    user.role = MagicMock()
    user.role.value = "admin"
    return user


def _mock_gemini_response(text_content):
    response = MagicMock()
    response.text = text_content
    return response


def _make_work_order_row(wo_id=None, job_number="JOB-001", notes="Some notes"):
    row = MagicMock()
    row.id = wo_id or uuid.uuid4()
    row.job_number = job_number
    row.internal_notes = notes
    return row


@patch("app.services.chat_monitoring.settings")
async def test_service_raises_without_api_key(mock_settings):
    mock_settings.gemini_api_key = ""
    with pytest.raises(ValueError, match="not configured"):
        ChatMonitoringService()


@patch("app.services.chat_monitoring.settings")
@patch("app.services.chat_monitoring.genai.Client")
async def test_analyze_message_relevant(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    wo_id = str(uuid.uuid4())
    gemini_response = json.dumps({
        "message_relevant": True,
        "suggested_updates": [
            {
                "work_order_id": wo_id,
                "work_order_job_number": "JOB-001",
                "field_to_update": "internal_notes",
                "suggested_value": "Customer confirmed delivery for Friday",
                "reason": "Message mentions JOB-001 delivery date",
                "confidence": 0.85,
            }
        ],
    })

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_gemini_response(
        gemini_response
    )
    mock_client.aio.models = mock_aio_models

    service = ChatMonitoringService()
    user = _mock_user()

    session = AsyncMock()
    wo_row = _make_work_order_row(wo_id=uuid.UUID(wo_id))
    mock_result = MagicMock()
    mock_result.all.return_value = [wo_row]
    session.execute.return_value = mock_result

    message = ChatMessage(text="JOB-001 delivery confirmed for Friday", author="John")
    result = await service.analyze_message(message, user, session)

    assert result.message_relevant is True
    assert len(result.suggested_updates) == 1
    assert result.suggested_updates[0].work_order_job_number == "JOB-001"
    assert result.suggested_updates[0].confidence == 0.85


@patch("app.services.chat_monitoring.settings")
@patch("app.services.chat_monitoring.genai.Client")
async def test_analyze_message_irrelevant(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    gemini_response = json.dumps({
        "message_relevant": False,
        "suggested_updates": [],
    })

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_gemini_response(
        gemini_response
    )
    mock_client.aio.models = mock_aio_models

    service = ChatMonitoringService()
    user = _mock_user()

    session = AsyncMock()
    wo_row = _make_work_order_row()
    mock_result = MagicMock()
    mock_result.all.return_value = [wo_row]
    session.execute.return_value = mock_result

    message = ChatMessage(text="Anyone want pizza for lunch?", author="Jane")
    result = await service.analyze_message(message, user, session)

    assert result.message_relevant is False
    assert len(result.suggested_updates) == 0


@patch("app.services.chat_monitoring.settings")
@patch("app.services.chat_monitoring.genai.Client")
async def test_analyze_message_no_work_orders(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    service = ChatMonitoringService()
    user = _mock_user()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.all.return_value = []
    session.execute.return_value = mock_result

    message = ChatMessage(text="JOB-001 is done", author="John")
    result = await service.analyze_message(message, user, session)

    assert result.message_relevant is False
    assert len(result.suggested_updates) == 0
    # Gemini should not have been called
    mock_client.aio.models.generate_content.assert_not_called()


@patch("app.services.chat_monitoring.settings")
@patch("app.services.chat_monitoring.genai.Client")
async def test_apply_update_internal_notes(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    service = ChatMonitoringService()
    user = _mock_user()

    wo_id = uuid.uuid4()
    work_order = MagicMock()
    work_order.id = wo_id
    work_order.organization_id = user.organization_id
    work_order.job_number = "JOB-001"
    work_order.internal_notes = "Existing notes"

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = work_order
    session.execute.return_value = mock_result

    request = ApplyUpdateRequest(
        work_order_id=wo_id,
        field_to_update="internal_notes",
        value="Customer confirmed delivery",
    )
    result = await service.apply_update(request, user, session)

    assert result.success is True
    assert "internal_notes" in result.message
    assert "[AI suggested]" in work_order.internal_notes
    assert "Customer confirmed delivery" in work_order.internal_notes
    assert "Existing notes" in work_order.internal_notes
    session.commit.assert_called_once()


@patch("app.services.chat_monitoring.settings")
@patch("app.services.chat_monitoring.genai.Client")
async def test_apply_update_nonexistent_work_order(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    service = ChatMonitoringService()
    user = _mock_user()

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    session.execute.return_value = mock_result

    request = ApplyUpdateRequest(
        work_order_id=uuid.uuid4(),
        field_to_update="internal_notes",
        value="Some note",
    )
    result = await service.apply_update(request, user, session)

    assert result.success is False
    assert "not found" in result.message.lower()
    session.commit.assert_not_called()


@patch("app.services.chat_monitoring.settings")
@patch("app.services.chat_monitoring.genai.Client")
async def test_apply_update_wrong_org(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    service = ChatMonitoringService()
    user = _mock_user()

    # Session returns None because the WHERE clause filters by org_id
    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    session.execute.return_value = mock_result

    request = ApplyUpdateRequest(
        work_order_id=uuid.uuid4(),
        field_to_update="internal_notes",
        value="Sneaky update",
    )
    result = await service.apply_update(request, user, session)

    assert result.success is False
    msg = result.message.lower()
    assert "not found" in msg or "organization" in msg


@patch("app.services.chat_monitoring.settings")
@patch("app.services.chat_monitoring.genai.Client")
async def test_apply_update_disallowed_field(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    service = ChatMonitoringService()
    user = _mock_user()
    session = AsyncMock()

    request = ApplyUpdateRequest(
        work_order_id=uuid.uuid4(),
        field_to_update="internal_notes",
        value="test",
    )
    # Override field_to_update after validation by mutating the object
    object.__setattr__(request, "field_to_update", "job_value")

    result = await service.apply_update(request, user, session)

    assert result.success is False
    assert "not allowed" in result.message.lower()


def test_parse_analysis_response_valid():
    raw = json.dumps({
        "message_relevant": True,
        "suggested_updates": [
            {
                "work_order_id": str(uuid.uuid4()),
                "work_order_job_number": "JOB-001",
                "field_to_update": "internal_notes",
                "suggested_value": "Test",
                "reason": "Match",
                "confidence": 0.9,
            }
        ],
    })
    result = _parse_analysis_response(raw)
    assert result.message_relevant is True
    assert len(result.suggested_updates) == 1


def test_parse_analysis_response_invalid_json():
    result = _parse_analysis_response("this is not json")
    assert result.message_relevant is False
    assert len(result.suggested_updates) == 0
    assert result.raw_analysis == "this is not json"


def test_parse_analysis_response_malformed_update():
    raw = json.dumps({
        "message_relevant": True,
        "suggested_updates": [
            {"work_order_id": "not-a-uuid"},  # missing required fields
        ],
    })
    result = _parse_analysis_response(raw)
    assert result.message_relevant is True
    assert len(result.suggested_updates) == 0
