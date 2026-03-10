import uuid

from sqlalchemy import select

from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


async def test_create_user(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id
    )
    db_session.add(org)
    await db_session.flush()

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(
        select(User).where(User.email == "admin@shop.com")
    )
    saved = result.scalar_one()
    assert saved.role == Role.ADMIN
    assert saved.organization_id == org.id
    assert saved.is_active is True
    assert saved.is_superadmin is False


async def test_superadmin_no_org(db_session):
    user = User(
        id=uuid.uuid4(),
        email="super@wrapflow.io",
        password_hash="hashed",
        role=Role.ADMIN,
        is_superadmin=True,
    )
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(
        select(User).where(User.email == "super@wrapflow.io")
    )
    saved = result.scalar_one()
    assert saved.is_superadmin is True
    assert saved.organization_id is None
