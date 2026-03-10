import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ai_assistant import AIAssistantService, validate_sql


def _mock_user(org_id=None):
    user = MagicMock()
    user.organization_id = org_id or uuid.uuid4()
    user.role = MagicMock()
    user.role.value = "admin"
    return user


def _mock_text_response(text_content):
    """Build a mock Anthropic response with a text block."""
    block = MagicMock()
    block.type = "text"
    block.text = text_content
    response = MagicMock()
    response.content = [block]
    return response


def _mock_tool_use_response(sql, explanation="Querying data"):
    """Build a mock Anthropic response with a tool_use block."""
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.name = "execute_sql"
    tool_block.id = "toolu_123"
    tool_block.input = {"sql": sql, "explanation": explanation}
    tool_block.model_dump.return_value = {
        "type": "tool_use",
        "id": "toolu_123",
        "name": "execute_sql",
        "input": {"sql": sql, "explanation": explanation},
    }
    response = MagicMock()
    response.content = [tool_block]
    return response


# --- SQL validation tests ---


def test_validate_sql_allows_select():
    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id"
    assert validate_sql(sql) is None


def test_validate_sql_rejects_insert():
    result = validate_sql("INSERT INTO work_orders (id) VALUES ('abc')")
    assert result is not None
    assert "disallowed" in result.lower() or "SELECT" in result


def test_validate_sql_rejects_update():
    sql = "UPDATE work_orders SET job_value = 0 WHERE organization_id = :org_id"
    result = validate_sql(sql)
    assert result is not None


def test_validate_sql_rejects_delete():
    result = validate_sql("DELETE FROM work_orders WHERE organization_id = :org_id")
    assert result is not None


def test_validate_sql_rejects_drop():
    result = validate_sql("DROP TABLE work_orders")
    assert result is not None


def test_validate_sql_rejects_alter():
    result = validate_sql("ALTER TABLE work_orders ADD COLUMN foo TEXT")
    assert result is not None


def test_validate_sql_rejects_truncate():
    result = validate_sql("TRUNCATE work_orders")
    assert result is not None


def test_validate_sql_rejects_create():
    result = validate_sql("CREATE TABLE foo (id INT)")
    assert result is not None


def test_validate_sql_rejects_grant():
    result = validate_sql("GRANT ALL ON work_orders TO public")
    assert result is not None


def test_validate_sql_rejects_revoke():
    result = validate_sql("REVOKE ALL ON work_orders FROM public")
    assert result is not None


def test_validate_sql_rejects_missing_org_id():
    result = validate_sql("SELECT * FROM work_orders")
    assert result is not None
    assert "organization_id" in result.lower()


def test_validate_sql_rejects_non_select():
    sql = "EXPLAIN SELECT * FROM work_orders WHERE organization_id = :org_id"
    result = validate_sql(sql)
    assert result is not None


def test_validate_sql_rejects_select_with_embedded_delete():
    sql = (
        "SELECT * FROM work_orders "
        "WHERE organization_id = :org_id; "
        "DELETE FROM work_orders"
    )
    result = validate_sql(sql)
    assert result is not None


# --- Service tests ---


@patch("app.services.ai_assistant.settings")
async def test_service_raises_without_api_key(mock_settings):
    mock_settings.anthropic_api_key = ""
    with pytest.raises(ValueError, match="not configured"):
        AIAssistantService()


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.anthropic.AsyncAnthropic")
async def test_answer_question_text_response(mock_anthropic_cls, mock_settings):
    mock_settings.anthropic_api_key = "test-key"
    mock_client = AsyncMock()
    mock_anthropic_cls.return_value = mock_client
    mock_client.messages.create.return_value = _mock_text_response(
        "There are no late jobs currently."
    )

    service = AIAssistantService()
    user = _mock_user()
    session = AsyncMock()

    result = await service.answer_question("Are there any late jobs?", user, session)

    assert result.answer == "There are no late jobs currently."
    assert result.query_executed is None
    assert result.data is None
    assert result.conversation_id is not None


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.anthropic.AsyncAnthropic")
async def test_answer_question_with_sql_execution(mock_anthropic_cls, mock_settings):
    mock_settings.anthropic_api_key = "test-key"
    mock_client = AsyncMock()
    mock_anthropic_cls.return_value = mock_client

    sql = "SELECT job_number FROM work_orders WHERE organization_id = :org_id LIMIT 100"

    # First call returns tool_use, second call returns summary
    mock_client.messages.create.side_effect = [
        _mock_tool_use_response(sql),
        _mock_text_response("You have 2 jobs: JOB-001 and JOB-002."),
    ]

    service = AIAssistantService()
    user = _mock_user()

    # Mock DB session
    mock_row_1 = MagicMock()
    mock_row_1._mapping = {"job_number": "JOB-001"}
    mock_row_2 = MagicMock()
    mock_row_2._mapping = {"job_number": "JOB-002"}

    session = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [mock_row_1, mock_row_2]
    session.execute.return_value = mock_result

    result = await service.answer_question("Show me all jobs", user, session)

    assert "JOB-001" in result.answer
    assert result.query_executed == sql
    assert result.data is not None
    assert len(result.data) == 2


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.anthropic.AsyncAnthropic")
async def test_answer_question_unsafe_sql_rejected(mock_anthropic_cls, mock_settings):
    mock_settings.anthropic_api_key = "test-key"
    mock_client = AsyncMock()
    mock_anthropic_cls.return_value = mock_client

    # Claude generates a dangerous query
    mock_client.messages.create.return_value = _mock_tool_use_response(
        "DELETE FROM work_orders WHERE organization_id = :org_id"
    )

    service = AIAssistantService()
    user = _mock_user()
    session = AsyncMock()

    result = await service.answer_question("Delete all my jobs", user, session)

    assert "unsafe" in result.answer.lower()
    # The session should never have been called
    session.execute.assert_not_called()


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.anthropic.AsyncAnthropic")
async def test_answer_question_sql_without_org_id_rejected(
    mock_anthropic_cls, mock_settings
):
    mock_settings.anthropic_api_key = "test-key"
    mock_client = AsyncMock()
    mock_anthropic_cls.return_value = mock_client

    mock_client.messages.create.return_value = _mock_tool_use_response(
        "SELECT * FROM work_orders"
    )

    service = AIAssistantService()
    user = _mock_user()
    session = AsyncMock()

    result = await service.answer_question("Show all jobs", user, session)

    answer_lower = result.answer.lower()
    assert "organization_id" in answer_lower or "unsafe" in answer_lower
    session.execute.assert_not_called()


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.anthropic.AsyncAnthropic")
async def test_answer_question_sql_error_handled(mock_anthropic_cls, mock_settings):
    mock_settings.anthropic_api_key = "test-key"
    mock_client = AsyncMock()
    mock_anthropic_cls.return_value = mock_client

    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id LIMIT 100"
    mock_client.messages.create.return_value = _mock_tool_use_response(sql)

    service = AIAssistantService()
    user = _mock_user()
    session = AsyncMock()
    session.execute.side_effect = Exception("relation does not exist")

    result = await service.answer_question("Show jobs", user, session)

    assert "error" in result.answer.lower()
    assert result.query_executed == sql
