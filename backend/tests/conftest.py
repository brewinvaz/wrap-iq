from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import all models so Base.metadata knows about them
import app.models  # noqa: F401
from app.config import settings
from app.db import Base


async def _cleanup(conn):
    # Drop all tables using SQLAlchemy metadata (handles FK ordering)
    await conn.run_sync(Base.metadata.drop_all)

    # Dynamically drop ALL custom enum types in the public schema.
    # This avoids maintaining a hardcoded list that goes stale when
    # new models/enums are added.
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
    engine = create_async_engine(settings.test_database_url, echo=False)
    async with engine.begin() as conn:
        await _cleanup(conn)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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
