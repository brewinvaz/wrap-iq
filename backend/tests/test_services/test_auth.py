import uuid

import pytest
from sqlalchemy import select

from app.models.plan import Plan
from app.models.user import Role, User
from app.services.auth import AuthService


@pytest.fixture
async def auth_service(db_session):
    return AuthService(db_session)


@pytest.fixture
async def default_plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    return plan


async def test_register(auth_service, default_plan):
    result = await auth_service.register(
        email="admin@newshop.com",
        password="SecurePass123",
        org_name="New Wrap Shop",
    )
    assert "access_token" in result
    assert "refresh_token" in result

    user = await auth_service.session.execute(
        select(User).where(User.email == "admin@newshop.com")
    )
    user = user.scalar_one()
    assert user.role == Role.ADMIN
    assert user.organization_id is not None


async def test_register_duplicate_email(auth_service, default_plan):
    await auth_service.register(
        email="dupe@shop.com", password="TestPass123", org_name="Shop 1"
    )
    with pytest.raises(ValueError, match="already registered"):
        await auth_service.register(
            email="dupe@shop.com", password="Pass456ab", org_name="Shop 2"
        )


async def test_login(auth_service, default_plan):
    await auth_service.register(
        email="login@shop.com", password="TestPass123", org_name="Login Shop"
    )
    result = await auth_service.login(email="login@shop.com", password="TestPass123")
    assert "access_token" in result
    assert "refresh_token" in result


async def test_login_wrong_password(auth_service, default_plan):
    await auth_service.register(
        email="wrong@shop.com", password="Correct1a", org_name="Wrong Shop"
    )
    with pytest.raises(ValueError, match="Invalid"):
        await auth_service.login(email="wrong@shop.com", password="incorrect")
