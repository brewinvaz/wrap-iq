import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ai_assistant import (
    AIAssistantService,
    _get_outermost_limit,
    _strip_sql_comments,
    ensure_outer_limit,
    validate_sql,
)


def _mock_user(org_id=None):
    user = MagicMock()
    user.organization_id = org_id or uuid.uuid4()
    user.role = MagicMock()
    user.role.value = "admin"
    return user


def _mock_text_response(text_content):
    """Build a mock Gemini response with a text part."""
    part = MagicMock()
    part.function_call = None
    part.text = text_content
    candidate = MagicMock()
    candidate.content.parts = [part]
    response = MagicMock()
    response.candidates = [candidate]
    return response


def _mock_function_call_response(sql, explanation="Querying data"):
    """Build a mock Gemini response with a function_call part."""
    fc = MagicMock()
    fc.name = "execute_sql"
    fc.args = {"sql": sql, "explanation": explanation}

    part = MagicMock()
    part.function_call = fc
    part.text = None

    candidate = MagicMock()
    candidate.content.parts = [part]
    response = MagicMock()
    response.candidates = [candidate]
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


def test_strip_sql_comments_removes_line_comments():
    sql = (
        "SELECT * FROM work_orders "
        "-- DROP TABLE work_orders\n"
        "WHERE organization_id = :org_id"
    )
    cleaned = _strip_sql_comments(sql)
    assert "DROP" not in cleaned
    assert "SELECT" in cleaned


def test_strip_sql_comments_removes_block_comments():
    sql = (
        "SELECT * FROM work_orders "
        "/* DELETE FROM work_orders */ "
        "WHERE organization_id = :org_id"
    )
    cleaned = _strip_sql_comments(sql)
    assert "DELETE" not in cleaned
    assert "SELECT" in cleaned


def test_validate_sql_rejects_dangerous_keyword_in_comment_bypass():
    # Attempt to hide DELETE after a line comment trick
    sql = (
        "SELECT * FROM work_orders "
        "WHERE organization_id = :org_id\n"
        "-- safe\n"
        "; DELETE FROM work_orders"
    )
    result = validate_sql(sql)
    assert result is not None


# --- LIMIT validation tests ---


def test_get_outermost_limit_simple():
    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id LIMIT 50"
    assert _get_outermost_limit(sql) == 50


def test_get_outermost_limit_none_when_absent():
    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id"
    assert _get_outermost_limit(sql) is None


def test_get_outermost_limit_union_with_limit_only_in_subquery():
    """LIMIT in a subquery of a UNION does not count as an outermost LIMIT."""
    sql = (
        "(SELECT * FROM work_orders WHERE organization_id = :org_id LIMIT 10) "
        "UNION ALL "
        "SELECT * FROM work_orders WHERE organization_id = :org_id"
    )
    assert _get_outermost_limit(sql) is None


def test_get_outermost_limit_union_with_outer_limit():
    sql = (
        "SELECT * FROM work_orders WHERE organization_id = :org_id "
        "UNION ALL "
        "SELECT * FROM work_orders WHERE organization_id = :org_id "
        "LIMIT 200"
    )
    assert _get_outermost_limit(sql) == 200


def test_ensure_outer_limit_appends_when_missing():
    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id"
    result = ensure_outer_limit(sql)
    assert result.endswith("LIMIT 100")


def test_ensure_outer_limit_keeps_existing_reasonable_limit():
    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id LIMIT 50"
    result = ensure_outer_limit(sql)
    assert "LIMIT 50" in result
    assert result.count("LIMIT") == 1


def test_ensure_outer_limit_caps_excessive_limit():
    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id LIMIT 5000"
    result = ensure_outer_limit(sql)
    assert "1000" in result


def test_ensure_outer_limit_union_bypass():
    """UNION query where LIMIT only appears in a subquery should get outer LIMIT."""
    sql = (
        "(SELECT * FROM work_orders WHERE organization_id = :org_id LIMIT 10) "
        "UNION ALL "
        "SELECT * FROM work_orders WHERE organization_id = :org_id"
    )
    result = ensure_outer_limit(sql)
    assert result.rstrip().endswith("LIMIT 100")


def test_ensure_outer_limit_strips_trailing_semicolon():
    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id LIMIT 50;"
    result = ensure_outer_limit(sql)
    assert not result.endswith(";")
    assert "LIMIT 50" in result


def test_ensure_outer_limit_no_limit_at_all():
    sql = "SELECT count(*) FROM work_orders WHERE organization_id = :org_id"
    result = ensure_outer_limit(sql)
    assert result.endswith("LIMIT 100")


# --- Service tests ---


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.genai.Client")
async def test_answer_question_uses_model_from_settings(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_settings.gemini_model = "gemini-custom-model"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_text_response(
        "No late jobs."
    )
    mock_client.aio.models = mock_aio_models

    service = AIAssistantService()
    user = _mock_user()
    session = AsyncMock()

    await service.answer_question("Any late jobs?", user, session)

    call_kwargs = mock_aio_models.generate_content.call_args
    assert call_kwargs.kwargs["model"] == "gemini-custom-model"


@patch("app.services.ai_assistant.settings")
async def test_service_raises_without_api_key(mock_settings):
    mock_settings.gemini_api_key = ""
    with pytest.raises(ValueError, match="not configured"):
        AIAssistantService()


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.genai.Client")
async def test_answer_question_text_response(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_text_response(
        "There are no late jobs currently."
    )
    mock_client.aio.models = mock_aio_models

    service = AIAssistantService()
    user = _mock_user()
    session = AsyncMock()

    result = await service.answer_question("Are there any late jobs?", user, session)

    assert result.answer == "There are no late jobs currently."
    assert result.query_executed is None
    assert result.data is None
    assert result.conversation_id is not None


@patch("app.services.ai_assistant.engine")
@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.genai.Client")
async def test_answer_question_with_sql_execution(
    mock_genai_cls, mock_settings, mock_engine
):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    sql = "SELECT job_number FROM work_orders WHERE organization_id = :org_id LIMIT 100"

    mock_aio_models = AsyncMock()
    # First call returns function_call, second call returns summary
    mock_aio_models.generate_content.side_effect = [
        _mock_function_call_response(sql),
        _mock_text_response("You have 2 jobs: JOB-001 and JOB-002."),
    ]
    mock_client.aio.models = mock_aio_models

    service = AIAssistantService()
    user = _mock_user()

    # Mock DB connection (read-only engine.connect)
    mock_row_1 = MagicMock()
    mock_row_1._mapping = {"job_number": "JOB-001"}
    mock_row_2 = MagicMock()
    mock_row_2._mapping = {"job_number": "JOB-002"}

    mock_conn = AsyncMock()
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [mock_row_1, mock_row_2]
    mock_conn.execute.return_value = mock_result
    mock_engine.connect.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_engine.connect.return_value.__aexit__ = AsyncMock(return_value=False)

    session = AsyncMock()

    result = await service.answer_question("Show me all jobs", user, session)

    assert "JOB-001" in result.answer
    assert result.query_executed == sql
    assert result.data is not None
    assert len(result.data) == 2


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.genai.Client")
async def test_answer_question_unsafe_sql_rejected(mock_genai_cls, mock_settings):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_function_call_response(
        "DELETE FROM work_orders WHERE organization_id = :org_id"
    )
    mock_client.aio.models = mock_aio_models

    service = AIAssistantService()
    user = _mock_user()
    session = AsyncMock()

    result = await service.answer_question("Delete all my jobs", user, session)

    assert "unsafe" in result.answer.lower()
    session.execute.assert_not_called()


@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.genai.Client")
async def test_answer_question_sql_without_org_id_rejected(
    mock_genai_cls, mock_settings
):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_function_call_response(
        "SELECT * FROM work_orders"
    )
    mock_client.aio.models = mock_aio_models

    service = AIAssistantService()
    user = _mock_user()
    session = AsyncMock()

    result = await service.answer_question("Show all jobs", user, session)

    answer_lower = result.answer.lower()
    assert "organization_id" in answer_lower or "unsafe" in answer_lower
    session.execute.assert_not_called()


@patch("app.services.ai_assistant.engine")
@patch("app.services.ai_assistant.settings")
@patch("app.services.ai_assistant.genai.Client")
async def test_answer_question_sql_error_handled(
    mock_genai_cls, mock_settings, mock_engine
):
    mock_settings.gemini_api_key = "test-key"
    mock_client = MagicMock()
    mock_genai_cls.return_value = mock_client

    sql = "SELECT * FROM work_orders WHERE organization_id = :org_id LIMIT 100"

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_function_call_response(sql)
    mock_client.aio.models = mock_aio_models

    service = AIAssistantService()
    user = _mock_user()

    mock_conn = AsyncMock()
    mock_conn.execute.side_effect = Exception("relation does not exist")
    mock_engine.connect.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_engine.connect.return_value.__aexit__ = AsyncMock(return_value=False)

    session = AsyncMock()

    result = await service.answer_question("Show jobs", user, session)

    assert "error" in result.answer.lower()
    assert result.query_executed == sql
