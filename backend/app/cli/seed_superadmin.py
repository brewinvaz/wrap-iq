"""Seed superadmin users.

Usage:
    # Seed default superadmins (from SUPERADMIN_EMAILS list):
    uv run python -m app.cli.seed_superadmin

    # Seed a specific superadmin with a password:
    SUPERADMIN_EMAIL=admin@wrapflow.io SUPERADMIN_PASSWORD=secret \
        uv run python -m app.cli.seed_superadmin
"""

import asyncio
import logging
import os
import secrets
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Import all models so Base.metadata is populated
import app.models  # noqa: F401
from app.auth.passwords import hash_password
from app.config import settings
from app.models.user import User

logger = logging.getLogger("wrapiq")

# Default superadmin emails — these users are seeded on every run.
SUPERADMIN_EMAILS = [
    "brewin@bluemintiq.com",
    "rini@bluemintiq.com",
]


async def _ensure_superadmin(session, email: str, password: str) -> None:
    result = await session.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()

    if existing:
        if existing.is_superadmin:
            logger.info("Superadmin already exists: %s", email)
        else:
            existing.is_superadmin = True
            await session.commit()
            logger.info("Upgraded existing user to superadmin: %s", email)
        return

    user_id = uuid.uuid4()
    await session.execute(
        text(
            "INSERT INTO users (id, organization_id, email, password_hash, role, is_active, is_superadmin) "
            "VALUES (:id, NULL, :email, :password_hash, 'admin', true, true)"
        ),
        {"id": user_id, "email": email, "password_hash": hash_password(password)},
    )
    await session.commit()
    logger.info("Created superadmin: %s (id=%s)", email, user_id)


async def seed_superadmin() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        # Seed from env vars if provided (backwards compatible)
        env_email = os.environ.get("SUPERADMIN_EMAIL")
        env_password = os.environ.get("SUPERADMIN_PASSWORD")
        if env_email and env_password:
            await _ensure_superadmin(session, env_email, env_password)

        # Seed default superadmins
        for email in SUPERADMIN_EMAILS:
            password = os.environ.get("SUPERADMIN_PASSWORD", secrets.token_urlsafe(32))
            await _ensure_superadmin(session, email, password)

    await engine.dispose()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_superadmin())


if __name__ == "__main__":
    main()
