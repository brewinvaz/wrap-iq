import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models.magic_link import MagicLink
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.refresh_token import RefreshToken
from app.models.user import User


async def _create_user(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="test@shop.com",
        password_hash="hashed",
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_create_magic_link(db_session):
    user = await _create_user(db_session)
    link = MagicLink(
        id=uuid.uuid4(),
        user_id=user.id,
        token="abc123",
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
    )
    db_session.add(link)
    await db_session.commit()

    result = await db_session.execute(
        select(MagicLink).where(MagicLink.token == "abc123")
    )
    saved = result.scalar_one()
    assert saved.user_id == user.id
    assert saved.used_at is None


async def test_create_refresh_token(db_session):
    user = await _create_user(db_session)
    token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token="refresh123",
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    db_session.add(token)
    await db_session.commit()

    result = await db_session.execute(
        select(RefreshToken).where(RefreshToken.token == "refresh123")
    )
    saved = result.scalar_one()
    assert saved.user_id == user.id
    assert saved.revoked_at is None
