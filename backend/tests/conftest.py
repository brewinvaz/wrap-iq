from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import all models so Base.metadata knows about them
import app.models  # noqa: F401
from app.config import settings
from app.db import Base
from app.middleware.rate_limit import limiter

# Disable rate limiting during tests (no Redis available)
limiter.enabled = False


async def _cleanup(conn):
    # Drop all tables in public schema (handles leftover tables from other branches)
    result = await conn.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    )
    for row in result:
        await conn.execute(text(f'DROP TABLE IF EXISTS "{row[0]}" CASCADE'))

    # Drop all custom enum types in public schema
    result = await conn.execute(
        text(
            "SELECT typname FROM pg_type WHERE typtype = 'e' "
            "AND typnamespace = (SELECT oid FROM pg_namespace "
            "WHERE nspname = 'public')"
        )
    )
    for row in result:
        await conn.execute(text(f'DROP TYPE IF EXISTS "{row[0]}" CASCADE'))


@pytest.fixture(autouse=True)
async def setup_db():
    engine = create_async_engine(settings.async_test_database_url, echo=False)
    async with engine.begin() as conn:
        await _cleanup(conn)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    yield engine
    async with engine.begin() as conn:
        await _cleanup(conn)
    await engine.dispose()


@pytest.fixture
async def db_session(setup_db) -> AsyncGenerator[AsyncSession]:
    session_factory = async_sessionmaker(setup_db, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
