import uuid
from decimal import Decimal

import pytest

from app.models.invoice import InvoiceStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.services.invoices import InvoiceService


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


async def test_create_invoice(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id,
        client_name="Jane Doe",
        client_email="jane@example.com",
        subtotal=100000,
        tax_rate=Decimal("8"),
        notes="Net 30",
    )

    assert invoice.invoice_number == "INV-1001"
    assert invoice.client_name == "Jane Doe"
    assert invoice.status == InvoiceStatus.DRAFT
    assert invoice.subtotal == 100000
    assert invoice.tax_amount == 8000
    assert invoice.total == 108000
    assert invoice.balance_due == 108000
    assert invoice.amount_paid == 0


async def test_create_multiple_invoices_increments_number(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    i1 = await service.create(
        org_id=org.id, client_name="A", client_email="a@x.com", subtotal=1000
    )
    i2 = await service.create(
        org_id=org.id, client_name="B", client_email="b@x.com", subtotal=2000
    )

    assert i1.invoice_number == "INV-1001"
    assert i2.invoice_number == "INV-1002"


async def test_list_invoices(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    await service.create(
        org_id=org.id, client_name="A", client_email="a@x.com", subtotal=1000
    )
    await service.create(
        org_id=org.id, client_name="B", client_email="b@x.com", subtotal=2000
    )

    items, total = await service.list(org.id)
    assert total == 2
    assert len(items) == 2


async def test_list_invoices_with_status_filter(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    i1 = await service.create(
        org_id=org.id, client_name="A", client_email="a@x.com", subtotal=1000
    )
    await service.create(
        org_id=org.id, client_name="B", client_email="b@x.com", subtotal=2000
    )

    # Record full payment on first to change status to paid
    await service.record_payment(i1.id, org.id, amount=1000)

    items, total = await service.list(org.id, InvoiceStatus.PAID)
    assert total == 1
    assert items[0].client_name == "A"


async def test_get_invoice(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id, client_name="John", client_email="john@x.com", subtotal=5000
    )

    fetched = await service.get(invoice.id, org.id)
    assert fetched is not None
    assert fetched.id == invoice.id


async def test_get_invoice_wrong_org(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id, client_name="John", client_email="john@x.com", subtotal=5000
    )

    fetched = await service.get(invoice.id, uuid.uuid4())
    assert fetched is None


async def test_record_payment_partial(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id, client_name="John", client_email="john@x.com", subtotal=10000
    )

    payment = await service.record_payment(
        invoice.id, org.id, amount=3000, payment_method="card", reference="txn_123"
    )
    assert payment is not None
    assert payment.amount == 3000

    updated = await service.get(invoice.id, org.id)
    assert updated.amount_paid == 3000
    assert updated.balance_due == 7000
    assert updated.status == InvoiceStatus.PARTIAL


async def test_record_payment_full(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id, client_name="John", client_email="john@x.com", subtotal=10000
    )

    await service.record_payment(invoice.id, org.id, amount=10000)

    updated = await service.get(invoice.id, org.id)
    assert updated.amount_paid == 10000
    assert updated.balance_due == 0
    assert updated.status == InvoiceStatus.PAID


async def test_record_payment_multiple(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id, client_name="John", client_email="john@x.com", subtotal=10000
    )

    await service.record_payment(invoice.id, org.id, amount=4000)
    await service.record_payment(invoice.id, org.id, amount=6000)

    updated = await service.get(invoice.id, org.id)
    assert updated.amount_paid == 10000
    assert updated.balance_due == 0
    assert updated.status == InvoiceStatus.PAID
    assert len(updated.payments) == 2


async def test_record_payment_exceeds_balance_raises(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id, client_name="John", client_email="john@x.com", subtotal=1000
    )

    with pytest.raises(ValueError, match="exceeds balance"):
        await service.record_payment(invoice.id, org.id, amount=2000)


async def test_record_payment_zero_raises(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id, client_name="John", client_email="john@x.com", subtotal=1000
    )

    with pytest.raises(ValueError, match="must be positive"):
        await service.record_payment(invoice.id, org.id, amount=0)


async def test_generate_payment_link(db_session):
    org = await _seed(db_session)
    service = InvoiceService(db_session)

    invoice = await service.create(
        org_id=org.id, client_name="John", client_email="john@x.com", subtotal=5000
    )

    link = await service.generate_payment_link(invoice.id, org.id)
    assert link is not None
    assert link.startswith("/pay/")

    updated = await service.get(invoice.id, org.id)
    assert updated.payment_link == link
