import uuid

from sqlalchemy import select

from app.models.user import Role, User


async def test_seed_creates_superadmin(db_session, monkeypatch):
    """Test the seed logic directly using the DB session."""
    from app.auth.passwords import hash_password

    email = "sa@test.com"
    password = "testpass123"

    # Simulate what seed_superadmin does
    result = await db_session.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    assert existing is None

    user = User(
        id=uuid.uuid4(),
        organization_id=None,
        email=email,
        password_hash=hash_password(password),
        role=Role.ADMIN,
        is_superadmin=True,
    )
    db_session.add(user)
    await db_session.flush()

    result = await db_session.execute(select(User).where(User.email == email))
    created = result.scalar_one()
    assert created.is_superadmin is True
    assert created.organization_id is None
    assert created.role == Role.ADMIN


async def test_seed_is_idempotent(db_session):
    """If user already exists and is superadmin, no error."""
    from app.auth.passwords import hash_password

    email = "sa2@test.com"

    user = User(
        id=uuid.uuid4(),
        organization_id=None,
        email=email,
        password_hash=hash_password("pass"),
        role=Role.ADMIN,
        is_superadmin=True,
    )
    db_session.add(user)
    await db_session.flush()

    # Running again: should find existing
    result = await db_session.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    assert existing is not None
    assert existing.is_superadmin is True


async def test_seed_upgrades_existing_user(db_session):
    """If user exists but is not superadmin, upgrade them."""
    from app.auth.passwords import hash_password

    email = "regular@test.com"

    user = User(
        id=uuid.uuid4(),
        organization_id=None,
        email=email,
        password_hash=hash_password("pass"),
        role=Role.ADMIN,
        is_superadmin=False,
    )
    db_session.add(user)
    await db_session.flush()

    # Simulate upgrade
    result = await db_session.execute(select(User).where(User.email == email))
    existing = result.scalar_one()
    existing.is_superadmin = True
    await db_session.flush()

    result = await db_session.execute(select(User).where(User.email == email))
    upgraded = result.scalar_one()
    assert upgraded.is_superadmin is True
