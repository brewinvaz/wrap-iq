from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import all models so Base.metadata knows about them
import app.models  # noqa: F401
from app.config import settings
from app.db import Base


@pytest.fixture(autouse=True)
async def setup_db():
    engine = create_async_engine(settings.test_database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        # Drop PostgreSQL enum types that are not removed by drop_all
        await conn.execute(text("DROP TYPE IF EXISTS role CASCADE"))
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.execute(text("DROP TYPE IF EXISTS role CASCADE"))
    await engine.dispose()


@pytest.fixture
async def db_session(setup_db) -> AsyncGenerator[AsyncSession]:
    session_factory = async_sessionmaker(setup_db, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
