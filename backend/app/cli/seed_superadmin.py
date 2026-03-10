"""Seed a superadmin user.

Usage:
    SUPERADMIN_EMAIL=admin@wrapflow.io SUPERADMIN_PASSWORD=secret \
        uv run python -m app.cli.seed_superadmin
"""

import asyncio
import os
import sys
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Import all models so Base.metadata is populated
import app.models  # noqa: F401
from app.auth.passwords import hash_password
from app.config import settings
from app.models.user import Role, User


async def seed_superadmin() -> None:
    email = os.environ.get("SUPERADMIN_EMAIL")
    password = os.environ.get("SUPERADMIN_PASSWORD")

    if not email or not password:
        print("Error: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD env vars are required.")
        sys.exit(1)

    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing:
            if existing.is_superadmin:
                print(f"Superadmin already exists: {email}")
            else:
                existing.is_superadmin = True
                await session.commit()
                print(f"Upgraded existing user to superadmin: {email}")
            await engine.dispose()
            return

        user = User(
            id=uuid.uuid4(),
            organization_id=None,
            email=email,
            password_hash=hash_password(password),
            role=Role.ADMIN,
            is_superadmin=True,
        )
        session.add(user)
        await session.commit()
        print(f"Created superadmin: {email} (id={user.id})")

    await engine.dispose()


def main() -> None:
    asyncio.run(seed_superadmin())


if __name__ == "__main__":
    main()
