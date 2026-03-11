import uuid
from decimal import Decimal

import pytest

from app.models.estimate import EstimateStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.services.estimates import EstimateService


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


async def test_create_estimate(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John Doe",
        client_email="john@example.com",
        line_items=[
            {
                "description": "Full wrap",
                "quantity": Decimal("1"),
                "unit_price": 250000,
            },
            {
                "description": "Design fee",
                "quantity": Decimal("1"),
                "unit_price": 50000,
            },
        ],
        tax_rate=Decimal("8"),
        notes="Rush job",
    )

    assert estimate.estimate_number == "EST-1001"
    assert estimate.client_name == "John Doe"
    assert estimate.status == EstimateStatus.DRAFT
    assert estimate.subtotal == 300000
    assert estimate.tax_amount == 24000
    assert estimate.total == 324000
    assert len(estimate.line_items) == 2
    assert estimate.notes == "Rush job"


async def test_create_multiple_estimates_increments_number(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    e1 = await service.create(
        org_id=org.id,
        client_name="A",
        client_email="a@x.com",
        line_items=[{"description": "Item", "unit_price": 1000}],
    )
    e2 = await service.create(
        org_id=org.id,
        client_name="B",
        client_email="b@x.com",
        line_items=[{"description": "Item", "unit_price": 2000}],
    )

    assert e1.estimate_number == "EST-1001"
    assert e2.estimate_number == "EST-1002"


async def test_list_estimates(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    await service.create(
        org_id=org.id,
        client_name="A",
        client_email="a@x.com",
        line_items=[{"description": "Item", "unit_price": 1000}],
    )
    await service.create(
        org_id=org.id,
        client_name="B",
        client_email="b@x.com",
        line_items=[{"description": "Item", "unit_price": 2000}],
    )

    items, total = await service.list(org.id)
    assert total == 2
    assert len(items) == 2


async def test_list_estimates_with_status_filter(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    e1 = await service.create(
        org_id=org.id,
        client_name="A",
        client_email="a@x.com",
        line_items=[{"description": "Item", "unit_price": 1000}],
    )
    await service.send(e1.id, org.id)

    await service.create(
        org_id=org.id,
        client_name="B",
        client_email="b@x.com",
        line_items=[{"description": "Item", "unit_price": 2000}],
    )

    items, total = await service.list(org.id, EstimateStatus.SENT)
    assert total == 1
    assert items[0].client_name == "A"


async def test_get_estimate(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John",
        client_email="john@x.com",
        line_items=[{"description": "Item", "unit_price": 5000}],
    )

    fetched = await service.get(estimate.id, org.id)
    assert fetched is not None
    assert fetched.id == estimate.id
    assert len(fetched.line_items) == 1


async def test_get_estimate_wrong_org(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John",
        client_email="john@x.com",
        line_items=[{"description": "Item", "unit_price": 5000}],
    )

    fetched = await service.get(estimate.id, uuid.uuid4())
    assert fetched is None


async def test_update_estimate(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="Old Name",
        client_email="old@x.com",
        line_items=[{"description": "Item", "unit_price": 1000}],
    )

    updated = await service.update(
        estimate.id, org.id, client_name="New Name", notes="Updated"
    )
    assert updated.client_name == "New Name"
    assert updated.notes == "Updated"


async def test_add_line_item(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John",
        client_email="john@x.com",
        line_items=[{"description": "Item 1", "unit_price": 10000}],
        tax_rate=Decimal("10"),
    )

    item = await service.add_line_item(
        estimate.id, org.id, description="Item 2", unit_price=5000
    )
    assert item is not None
    assert item.description == "Item 2"
    assert item.total == 5000

    refreshed = await service.get(estimate.id, org.id)
    assert len(refreshed.line_items) == 2
    assert refreshed.subtotal == 15000
    assert refreshed.tax_amount == 1500
    assert refreshed.total == 16500


async def test_remove_line_item(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John",
        client_email="john@x.com",
        line_items=[
            {"description": "Item 1", "unit_price": 10000},
            {"description": "Item 2", "unit_price": 5000},
        ],
    )

    item_id = estimate.line_items[0].id
    removed = await service.remove_line_item(item_id, estimate.id, org.id)
    assert removed is True

    refreshed = await service.get(estimate.id, org.id)
    assert len(refreshed.line_items) == 1
    assert refreshed.subtotal == 5000


async def test_recalculate(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John",
        client_email="john@x.com",
        line_items=[
            {"description": "Item", "quantity": Decimal("2"), "unit_price": 10000},
        ],
        tax_rate=Decimal("5"),
    )

    assert estimate.subtotal == 20000
    assert estimate.tax_amount == 1000
    assert estimate.total == 21000

    recalculated = await service.recalculate(estimate.id, org.id)
    assert recalculated.subtotal == 20000
    assert recalculated.total == 21000


async def test_send_estimate(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John",
        client_email="john@x.com",
        line_items=[{"description": "Item", "unit_price": 1000}],
    )

    sent = await service.send(estimate.id, org.id)
    assert sent.status == EstimateStatus.SENT
    assert sent.sent_at is not None


async def test_convert_to_invoice(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John",
        client_email="john@x.com",
        line_items=[{"description": "Full wrap", "unit_price": 250000}],
        tax_rate=Decimal("8"),
    )

    # Must accept before converting
    estimate.status = EstimateStatus.ACCEPTED
    await db_session.commit()

    invoice = await service.convert_to_invoice(estimate.id, org.id)
    assert invoice is not None
    assert invoice.invoice_number == "INV-1001"
    assert invoice.client_name == "John"
    assert invoice.subtotal == estimate.subtotal
    assert invoice.total == estimate.total
    assert invoice.balance_due == estimate.total
    assert invoice.estimate_id == estimate.id


async def test_convert_draft_estimate_raises(db_session):
    org = await _seed(db_session)
    service = EstimateService(db_session)

    estimate = await service.create(
        org_id=org.id,
        client_name="John",
        client_email="john@x.com",
        line_items=[{"description": "Item", "unit_price": 1000}],
    )

    with pytest.raises(ValueError, match="Only accepted estimates"):
        await service.convert_to_invoice(estimate.id, org.id)
