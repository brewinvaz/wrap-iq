import uuid

import pytest
from fastapi import HTTPException

from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


@pytest.fixture
async def test_user(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="dep@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_get_current_user_valid(db_session, test_user):
    token = create_access_token(
        user_id=test_user.id,
        organization_id=test_user.organization_id,
        role=test_user.role.value,
    )
    user = await get_current_user(token=token, session=db_session)
    assert user.id == test_user.id
    assert user.email == "dep@shop.com"


async def test_get_current_user_invalid_token(db_session):
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token="bad.token.here", session=db_session)
    assert exc_info.value.status_code == 401
