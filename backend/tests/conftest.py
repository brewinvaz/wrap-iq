from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import all models so Base.metadata knows about them
import app.models  # noqa: F401
from app.config import settings
from app.db import Base

# All known tables that may have FK dependencies, in safe drop order
_DROP_TABLES = [
    "api_key_usage_logs",
    "api_keys",
    "payments",
    "estimate_line_items",
    "invoices",
    "estimates",
    "message_logs",
    "message_templates",
    "audit_logs",
    "install_time_logs",
    "notifications",
    "magic_links",
    "refresh_tokens",
    "kanban_stages",
    "users",
    "organizations",
    "plans",
]

# All known enum types
_DROP_TYPES = [
    "role",
    "notificationtype",
    "actiontype",
    "systemstatus",
    "vehicletype",
    "jobtype",
    "priority",
    "wrapcoverage",
    "roof_coverage_level",
    "door_handle_coverage",
    "windowcoverage",
    "bumpercoverage",
    "logtype",
    "installlocation",
    "installdifficulty",
    "triggertype",
    "channeltype",
    "messagestatus",
    "estimatestatus",
    "invoicestatus",
]


async def _cleanup(conn):
    for table in _DROP_TABLES:
        await conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
    for typ in _DROP_TYPES:
        await conn.execute(text(f"DROP TYPE IF EXISTS {typ} CASCADE"))


@pytest.fixture(autouse=True)
async def setup_db():
    engine = create_async_engine(settings.test_database_url, echo=False)
    async with engine.begin() as conn:
        await _cleanup(conn)
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await _cleanup(conn)
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(setup_db) -> AsyncGenerator[AsyncSession]:
    session_factory = async_sessionmaker(setup_db, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
