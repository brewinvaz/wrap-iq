import uuid

import pytest

from app.models.user import Role, User
from app.models.user_profile import UserProfile


async def test_create_user_profile(db_session):
    user = User(
        id=uuid.uuid4(),
        organization_id=None,
        email="client@test.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(user)
    await db_session.flush()

    profile = UserProfile(
        id=uuid.uuid4(),
        user_id=user.id,
        first_name="Jane",
        last_name="Doe",
        phone="555-1234",
        company_name="Doe Fleet",
        address="123 Main St",
    )
    db_session.add(profile)
    await db_session.flush()

    assert profile.first_name == "Jane"
    assert profile.user_id == user.id


async def test_user_profile_unique_user_id(db_session):
    user = User(
        id=uuid.uuid4(),
        organization_id=None,
        email="client2@test.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(user)
    await db_session.flush()

    p1 = UserProfile(id=uuid.uuid4(), user_id=user.id, first_name="A")
    db_session.add(p1)
    await db_session.flush()

    p2 = UserProfile(id=uuid.uuid4(), user_id=user.id, first_name="B")
    db_session.add(p2)
    with pytest.raises(Exception):
        await db_session.flush()
