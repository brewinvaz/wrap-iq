import uuid
from decimal import Decimal

from sqlalchemy import select

from app.models.organization import Organization
from app.models.plan import Plan


async def test_create_organization(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(),
        name="Test Wrap Shop",
        slug="test-wrap-shop",
        plan_id=plan.id,
    )
    db_session.add(org)
    await db_session.commit()

    result = await db_session.execute(
        select(Organization).where(Organization.slug == "test-wrap-shop")
    )
    saved = result.scalar_one()
    assert saved.name == "Test Wrap Shop"
    assert saved.plan_id == plan.id
    assert saved.is_active is True


async def test_organization_hourly_cost(db_session):
    plan = Plan(id=uuid.uuid4(), name="Pro", price_cents=4999, is_default=False)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(),
        name="Premium Shop",
        slug="premium-shop",
        plan_id=plan.id,
        hourly_cost=Decimal("75.00"),
    )
    db_session.add(org)
    await db_session.commit()

    result = await db_session.execute(
        select(Organization).where(Organization.slug == "premium-shop")
    )
    saved = result.scalar_one()
    assert saved.hourly_cost == Decimal("75.00")
