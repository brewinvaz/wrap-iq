import uuid
from unittest.mock import AsyncMock, patch

from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.work_order import WorkOrder
from app.services.csv_upload import parse_csv, process_upload, validate_row


def _make_csv(headers: str, *rows: str) -> bytes:
    """Helper to build CSV content bytes."""
    lines = [headers, *rows]
    return "\n".join(lines).encode("utf-8")


# ── parse_csv tests ─────────────────────────────────────────────────────


async def test_parse_valid_csv_all_columns():
    hdr = (
        "client_name,client_email,vin,year,make,model,"
        "vehicle_type,job_type,job_value,priority,notes"
    )
    row = (
        "Acme Corp,acme@test.com,1HGCM82633A004352,"
        "2023,Honda,Accord,car,Commercial,1500.00,High,Full wrap"
    )
    content = _make_csv(hdr, row)
    rows, errors = parse_csv(content)
    assert errors == []
    assert len(rows) == 1
    assert rows[0]["client_name"] == "Acme Corp"
    assert rows[0]["vin"] == "1HGCM82633A004352"
    assert rows[0]["year"] == "2023"
    assert rows[0]["job_value"] == "1500.00"


async def test_parse_csv_required_columns_only():
    content = _make_csv(
        "client_name",
        "Acme Corp",
        "Bob's Shop",
    )
    rows, errors = parse_csv(content)
    assert errors == []
    assert len(rows) == 2
    assert rows[0]["client_name"] == "Acme Corp"
    assert rows[1]["client_name"] == "Bob's Shop"


async def test_parse_csv_missing_required_column():
    content = _make_csv(
        "vin,year,make",
        "1HGCM82633A004352,2023,Honda",
    )
    rows, errors = parse_csv(content)
    assert len(errors) == 1
    assert errors[0].field == "client_name"
    assert "missing" in errors[0].message.lower()


async def test_parse_csv_with_bom():
    content = b"\xef\xbb\xbfclient_name\nAcme Corp\n"
    rows, errors = parse_csv(content)
    assert errors == []
    assert len(rows) == 1
    assert rows[0]["client_name"] == "Acme Corp"


async def test_parse_empty_csv():
    content = b""
    rows, errors = parse_csv(content)
    assert len(errors) == 1
    assert "empty" in errors[0].message.lower()


# ── validate_row tests ──────────────────────────────────────────────────


async def test_validate_row_valid():
    row = {
        "client_name": "Acme Corp",
        "job_type": "commercial",
        "priority": "high",
        "vehicle_type": "car",
        "year": "2023",
        "job_value": "1500.00",
    }
    errors = validate_row(row, 2)
    assert errors == []


async def test_validate_row_missing_client_name():
    row = {"client_name": "", "job_type": "commercial"}
    errors = validate_row(row, 2)
    assert any("client_name" in e for e in errors)


async def test_validate_row_invalid_job_type():
    row = {"client_name": "Acme", "job_type": "invalid_type"}
    errors = validate_row(row, 2)
    assert any("job_type" in e.lower() for e in errors)


async def test_validate_row_invalid_priority():
    row = {"client_name": "Acme", "priority": "urgent"}
    errors = validate_row(row, 2)
    assert any("priority" in e.lower() for e in errors)


async def test_validate_row_invalid_year():
    row = {"client_name": "Acme", "year": "not_a_year"}
    errors = validate_row(row, 2)
    assert any("year" in e.lower() for e in errors)


async def test_validate_row_invalid_job_value():
    row = {"client_name": "Acme", "job_value": "abc"}
    errors = validate_row(row, 2)
    assert any("job_value" in e.lower() for e in errors)


async def test_validate_row_negative_job_value():
    row = {"client_name": "Acme", "job_value": "-100"}
    errors = validate_row(row, 2)
    assert any("negative" in e.lower() for e in errors)


# ── process_upload tests ────────────────────────────────────────────────


async def _setup_org_and_stage(db_session):
    """Create org and kanban stage for process_upload tests."""
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(),
        name="Test Shop",
        slug="test-shop",
        plan_id=plan.id,
    )
    db_session.add(org)
    await db_session.flush()

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Lead",
        position=0,
        system_status=SystemStatus.LEAD,
        is_default=True,
        is_active=True,
    )
    db_session.add(stage)
    await db_session.flush()

    return org, stage


async def test_process_upload_creates_work_orders(db_session):
    org, stage = await _setup_org_and_stage(db_session)
    user_id = uuid.uuid4()

    hdr = (
        "client_name,client_email,year,make,model,"
        "vehicle_type,job_type,job_value,priority,notes"
    )
    row1 = (
        "Acme Corp,acme@test.com,2023,Honda,Accord,"
        "car,Commercial,1500.00,High,Full wrap"
    )
    row2 = (
        "Bob Shop,bob@test.com,2024,Ford,Transit,van,Personal,2000.00,Low,Partial wrap"
    )
    content = _make_csv(hdr, row1, row2)

    result = await process_upload(org.id, user_id, content, db_session)

    assert result.total_rows == 2
    assert result.successful == 2
    assert result.failed == 0
    assert len(result.created_work_order_ids) == 2
    assert result.errors == []


async def test_process_upload_with_vin_triggers_lookup(db_session):
    org, stage = await _setup_org_and_stage(db_session)
    user_id = uuid.uuid4()

    content = _make_csv(
        "client_name,vin",
        "Acme Corp,1HGCM82633A004352",
    )

    mock_vin_info = AsyncMock()
    mock_vin_info.year = 2023
    mock_vin_info.make = "Honda"
    mock_vin_info.model = "Accord"
    mock_vin_info.vehicle_type = AsyncMock()
    mock_vin_info.vehicle_type.value = "Car"

    with patch(
        "app.services.vin.decode_vin",
        new_callable=AsyncMock,
        return_value=mock_vin_info,
    ) as mock_decode:
        result = await process_upload(org.id, user_id, content, db_session)
        mock_decode.assert_called_once_with("1HGCM82633A004352")

    assert result.successful == 1
    assert result.failed == 0


async def test_process_upload_reports_per_row_errors(db_session):
    org, stage = await _setup_org_and_stage(db_session)
    user_id = uuid.uuid4()

    content = _make_csv(
        "client_name,job_type",
        "Acme Corp,Commercial",
        ",Commercial",  # Missing client_name
        "Good Corp,Personal",
    )

    result = await process_upload(org.id, user_id, content, db_session)

    assert result.total_rows == 3
    assert result.successful == 2
    assert result.failed == 1
    assert len(result.errors) >= 1
    # The error should be on row 3 (1-indexed + header)
    assert any(e.row == 3 for e in result.errors)


async def test_process_upload_no_stages_configured(db_session):
    """Upload should fail gracefully when no kanban stages exist."""
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(),
        name="Empty Shop",
        slug="empty-shop",
        plan_id=plan.id,
    )
    db_session.add(org)
    await db_session.flush()

    content = _make_csv(
        "client_name",
        "Acme Corp",
    )

    result = await process_upload(org.id, uuid.uuid4(), content, db_session)
    assert result.failed == 1
    assert result.successful == 0
    assert any("kanban" in e.message.lower() for e in result.errors)


async def test_process_upload_job_value_converted_to_cents(db_session):
    """Verify dollar amounts are converted to cents."""
    org, stage = await _setup_org_and_stage(db_session)
    user_id = uuid.uuid4()

    content = _make_csv(
        "client_name,job_value",
        "Acme Corp,1500.50",
    )

    result = await process_upload(org.id, user_id, content, db_session)
    assert result.successful == 1

    from sqlalchemy import select

    wo_result = await db_session.execute(
        select(WorkOrder).where(WorkOrder.id == result.created_work_order_ids[0])
    )
    wo = wo_result.scalar_one()
    assert wo.job_value == 150050  # $1500.50 = 150050 cents
