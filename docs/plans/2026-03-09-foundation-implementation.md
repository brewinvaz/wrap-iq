# Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the multi-tenant auth foundation — Alembic migrations, core models (Organization, User, Plan), JWT auth, magic links, RBAC, and tenant isolation.

**Architecture:** Shared-database multi-tenancy with `organization_id` on all tenant-scoped tables. Self-managed JWT auth with bcrypt passwords and Resend magic links. FastAPI dependency injection for tenant scoping.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, asyncpg, PyJWT, bcrypt, Resend, pytest

---

### Task 1: Add new dependencies

**Files:**
- Modify: `backend/pyproject.toml`

**Step 1: Add PyJWT, bcrypt, resend to dependencies**

Add to the `dependencies` list in `pyproject.toml`:

```toml
"pyjwt>=2.9.0",
"bcrypt>=4.2.0",
"resend>=2.5.0",
```

**Step 2: Add RESEND_API_KEY and JWT settings to config**

Modify `backend/app/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/wrapiq"
    test_database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/wrapiq_test"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "dev-secret-key-change-in-production"
    cors_origins: str = "http://localhost:3000"
    debug: bool = True
    frontend_url: str = "http://localhost:3000"

    # JWT
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Email
    resend_api_key: str = ""
    email_from: str = "WrapFlow <noreply@wrapflow.io>"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
```

**Step 3: Update .env.example**

Add to `backend/.env.example`:

```
RESEND_API_KEY=
EMAIL_FROM=WrapFlow <noreply@wrapflow.io>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

**Step 4: Install dependencies**

Run: `cd backend && uv sync`

**Step 5: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/app/config.py backend/.env.example
git commit -m "feat: add JWT, bcrypt, resend dependencies and config settings"
```

---

### Task 2: Initialize Alembic

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/` (empty directory)

**Step 1: Initialize alembic inside the backend container**

Run: `docker compose exec backend uv run alembic init alembic`

This creates `alembic.ini` and the `alembic/` directory.

**Step 2: Update alembic.ini**

Set the sqlalchemy.url to empty (we'll override it in env.py):

In `backend/alembic.ini`, change:
```ini
sqlalchemy.url =
```

**Step 3: Update alembic/env.py for async + our models**

Replace `backend/alembic/env.py` with:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.db import Base
from app.models import *  # noqa: F401,F403 — ensure all models are registered

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

**Step 4: Update db.py to export Base**

Replace `backend/app/db.py` with:

```python
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)

async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
```

**Step 5: Verify alembic can run**

Run: `docker compose exec backend uv run alembic check`

Expected: No errors (no pending migrations since no models yet).

**Step 6: Commit**

```bash
git add backend/alembic.ini backend/alembic/ backend/app/db.py
git commit -m "feat: initialize alembic with async SQLAlchemy support"
```

---

### Task 3: Create base model and tenant mixin

**Files:**
- Create: `backend/app/models/base.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write the base model with tenant mixin**

Create `backend/app/models/base.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TenantMixin:
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), index=True
    )
```

**Step 2: Update models __init__.py**

```python
from app.models.base import Base, TenantMixin, TimestampMixin

__all__ = ["Base", "TenantMixin", "TimestampMixin"]
```

Wait — `Base` is in `app.db`, not models. Update `__init__.py` to just re-export what's needed:

```python
from app.models.base import TenantMixin, TimestampMixin

__all__ = ["TenantMixin", "TimestampMixin"]
```

**Step 3: Commit**

```bash
git add backend/app/models/base.py backend/app/models/__init__.py
git commit -m "feat: add TimestampMixin and TenantMixin for models"
```

---

### Task 4: Create Plan model

**Files:**
- Create: `backend/app/models/plan.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write the failing test**

Create `backend/tests/__init__.py` (empty) and `backend/tests/conftest.py`:

```python
import asyncio
import uuid
from collections.abc import AsyncGenerator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db import Base

# Use the test database
test_engine = create_async_engine(settings.test_database_url, echo=False)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session
        await session.rollback()
```

Create `backend/tests/test_models/__init__.py` (empty) and `backend/tests/test_models/test_plan.py`:

```python
import uuid

from sqlalchemy import select

from app.models.plan import Plan


async def test_create_plan(db_session):
    plan = Plan(
        id=uuid.uuid4(),
        name="Free",
        features={"max_projects": 10},
        price_cents=0,
        is_default=True,
    )
    db_session.add(plan)
    await db_session.commit()

    result = await db_session.execute(select(Plan).where(Plan.name == "Free"))
    saved = result.scalar_one()
    assert saved.name == "Free"
    assert saved.price_cents == 0
    assert saved.is_default is True
    assert saved.features == {"max_projects": 10}
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_models/test_plan.py -v`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.plan'`

**Step 3: Write the Plan model**

Create `backend/app/models/plan.py`:

```python
import uuid

from sqlalchemy import Boolean, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TimestampMixin


class Plan(Base, TimestampMixin):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    features: Mapped[dict] = mapped_column(JSONB, default=dict)
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
```

**Step 4: Update models __init__.py**

```python
from app.models.base import TenantMixin, TimestampMixin
from app.models.plan import Plan

__all__ = ["TenantMixin", "TimestampMixin", "Plan"]
```

**Step 5: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_models/test_plan.py -v`

Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add Plan model with test"
```

---

### Task 5: Create Organization model

**Files:**
- Create: `backend/app/models/organization.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/test_models/test_organization.py`

**Step 1: Write the failing test**

Create `backend/tests/test_models/test_organization.py`:

```python
import uuid

from sqlalchemy import select

from app.models.organization import Organization
from app.models.plan import Plan


async def test_create_organization(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(),
        name="Test Wrap Shop",
        slug="test-wrap-shop",
        plan_id=plan.id,
    )
    db_session.add(org)
    await db_session.commit()

    result = await db_session.execute(
        select(Organization).where(Organization.slug == "test-wrap-shop")
    )
    saved = result.scalar_one()
    assert saved.name == "Test Wrap Shop"
    assert saved.plan_id == plan.id
    assert saved.is_active is True
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_models/test_organization.py -v`

Expected: FAIL — `ModuleNotFoundError`

**Step 3: Write the Organization model**

Create `backend/app/models/organization.py`:

```python
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("plans.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    plan = relationship("Plan", lazy="selectin")
    users = relationship("User", back_populates="organization", lazy="selectin")
```

**Step 4: Update models __init__.py**

```python
from app.models.base import TenantMixin, TimestampMixin
from app.models.organization import Organization
from app.models.plan import Plan

__all__ = ["TenantMixin", "TimestampMixin", "Organization", "Plan"]
```

**Step 5: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/test_models/test_organization.py -v`

Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add Organization model with test"
```

---

### Task 6: Create User model with roles

**Files:**
- Create: `backend/app/models/user.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/test_models/test_user.py`

**Step 1: Write the failing test**

Create `backend/tests/test_models/test_user.py`:

```python
import uuid

from sqlalchemy import select

from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


async def test_create_user(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id
    )
    db_session.add(org)
    await db_session.flush()

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(
        select(User).where(User.email == "admin@shop.com")
    )
    saved = result.scalar_one()
    assert saved.role == Role.ADMIN
    assert saved.organization_id == org.id
    assert saved.is_active is True
    assert saved.is_superadmin is False


async def test_superadmin_no_org(db_session):
    user = User(
        id=uuid.uuid4(),
        email="super@wrapflow.io",
        password_hash="hashed",
        role=Role.ADMIN,
        is_superadmin=True,
    )
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(
        select(User).where(User.email == "super@wrapflow.io")
    )
    saved = result.scalar_one()
    assert saved.is_superadmin is True
    assert saved.organization_id is None
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_models/test_user.py -v`

Expected: FAIL

**Step 3: Write the User model**

Create `backend/app/models/user.py`:

```python
import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin


class Role(str, enum.Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    INSTALLER = "installer"
    DESIGNER = "designer"
    PRODUCTION = "production"
    CLIENT = "client"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("organizations.id"), index=True, nullable=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.ADMIN)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)

    organization = relationship("Organization", back_populates="users", lazy="selectin")
```

**Step 4: Update models __init__.py**

```python
from app.models.base import TenantMixin, TimestampMixin
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User

__all__ = ["TenantMixin", "TimestampMixin", "Organization", "Plan", "Role", "User"]
```

**Step 5: Run tests**

Run: `cd backend && uv run pytest tests/test_models/test_user.py -v`

Expected: PASS (2 tests)

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add User model with Role enum and superadmin flag"
```

---

### Task 7: Create MagicLink and RefreshToken models

**Files:**
- Create: `backend/app/models/magic_link.py`
- Create: `backend/app/models/refresh_token.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/test_models/test_auth_tokens.py`

**Step 1: Write the failing test**

Create `backend/tests/test_models/test_auth_tokens.py`:

```python
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models.magic_link import MagicLink
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.refresh_token import RefreshToken
from app.models.user import User


async def _create_user(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="test@shop.com",
        password_hash="hashed",
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_create_magic_link(db_session):
    user = await _create_user(db_session)
    link = MagicLink(
        id=uuid.uuid4(),
        user_id=user.id,
        token="abc123",
        expires_at=datetime.now(UTC) + timedelta(minutes=15),
    )
    db_session.add(link)
    await db_session.commit()

    result = await db_session.execute(
        select(MagicLink).where(MagicLink.token == "abc123")
    )
    saved = result.scalar_one()
    assert saved.user_id == user.id
    assert saved.used_at is None


async def test_create_refresh_token(db_session):
    user = await _create_user(db_session)
    token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token="refresh123",
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    db_session.add(token)
    await db_session.commit()

    result = await db_session.execute(
        select(RefreshToken).where(RefreshToken.token == "refresh123")
    )
    saved = result.scalar_one()
    assert saved.user_id == user.id
    assert saved.revoked_at is None
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_models/test_auth_tokens.py -v`

Expected: FAIL

**Step 3: Write MagicLink model**

Create `backend/app/models/magic_link.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TimestampMixin


class MagicLink(Base, TimestampMixin):
    __tablename__ = "magic_links"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

**Step 4: Write RefreshToken model**

Create `backend/app/models/refresh_token.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TimestampMixin


class RefreshToken(Base, TimestampMixin):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

**Step 5: Update models __init__.py**

```python
from app.models.base import TenantMixin, TimestampMixin
from app.models.magic_link import MagicLink
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.refresh_token import RefreshToken
from app.models.user import Role, User

__all__ = [
    "MagicLink",
    "Organization",
    "Plan",
    "RefreshToken",
    "Role",
    "TenantMixin",
    "TimestampMixin",
    "User",
]
```

**Step 6: Run tests**

Run: `cd backend && uv run pytest tests/test_models/ -v`

Expected: PASS (all tests)

**Step 7: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add MagicLink and RefreshToken models"
```

---

### Task 8: Generate and run first Alembic migration

**Files:**
- Create: `backend/alembic/versions/001_initial.py` (auto-generated)

**Step 1: Generate migration**

Run: `docker compose exec backend uv run alembic revision --autogenerate -m "initial tables"`

**Step 2: Review the generated migration**

Read the generated file in `backend/alembic/versions/` and verify it creates:
- `plans` table
- `organizations` table (FK to plans)
- `users` table (FK to organizations)
- `magic_links` table (FK to users)
- `refresh_tokens` table (FK to users)

**Step 3: Run migration**

Run: `docker compose exec backend uv run alembic upgrade head`

Expected: Tables created successfully.

**Step 4: Verify tables exist**

Run: `docker compose exec db psql -U postgres -d wrapiq -c "\dt"`

Expected: Lists all 5 tables plus `alembic_version`.

**Step 5: Commit**

```bash
git add backend/alembic/
git commit -m "feat: add initial migration for core tables"
```

---

### Task 9: Password hashing and JWT utilities

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/passwords.py`
- Create: `backend/app/auth/jwt.py`
- Create: `backend/tests/test_auth/__init__.py`
- Create: `backend/tests/test_auth/test_passwords.py`
- Create: `backend/tests/test_auth/test_jwt.py`

**Step 1: Write the failing password tests**

Create `backend/tests/test_auth/__init__.py` (empty) and `backend/tests/test_auth/test_passwords.py`:

```python
from app.auth.passwords import hash_password, verify_password


def test_hash_and_verify():
    password = "mysecretpassword"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True


def test_wrong_password():
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_auth/test_passwords.py -v`

Expected: FAIL

**Step 3: Implement passwords.py**

Create `backend/app/auth/__init__.py` (empty) and `backend/app/auth/passwords.py`:

```python
import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())
```

**Step 4: Run password tests**

Run: `cd backend && uv run pytest tests/test_auth/test_passwords.py -v`

Expected: PASS

**Step 5: Write the failing JWT tests**

Create `backend/tests/test_auth/test_jwt.py`:

```python
import uuid

import pytest

from app.auth.jwt import create_access_token, create_refresh_token, decode_token


def test_create_and_decode_access_token():
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    token = create_access_token(user_id=user_id, organization_id=org_id, role="admin")
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["org"] == str(org_id)
    assert payload["role"] == "admin"
    assert payload["type"] == "access"


def test_create_and_decode_refresh_token():
    user_id = uuid.uuid4()
    token = create_refresh_token(user_id=user_id)
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "refresh"


def test_decode_invalid_token():
    with pytest.raises(Exception):
        decode_token("invalid.token.here")
```

**Step 6: Run JWT test to verify it fails**

Run: `cd backend && uv run pytest tests/test_auth/test_jwt.py -v`

Expected: FAIL

**Step 7: Implement jwt.py**

Create `backend/app/auth/jwt.py`:

```python
import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings


def create_access_token(
    user_id: uuid.UUID,
    organization_id: uuid.UUID | None = None,
    role: str = "admin",
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "org": str(organization_id) if organization_id else None,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.refresh_token_expire_days),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
```

**Step 8: Run all auth tests**

Run: `cd backend && uv run pytest tests/test_auth/ -v`

Expected: PASS (5 tests)

**Step 9: Commit**

```bash
git add backend/app/auth/ backend/tests/test_auth/
git commit -m "feat: add password hashing and JWT token utilities"
```

---

### Task 10: Email service (Resend + dev fallback)

**Files:**
- Create: `backend/app/services/email.py`
- Create: `backend/tests/test_services/__init__.py`
- Create: `backend/tests/test_services/test_email.py`

**Step 1: Write the failing test**

Create `backend/tests/test_services/__init__.py` (empty) and `backend/tests/test_services/test_email.py`:

```python
from unittest.mock import AsyncMock, patch

import pytest

from app.services.email import send_magic_link_email


@pytest.mark.asyncio
async def test_send_magic_link_dev_mode(capsys):
    """In dev mode (no RESEND_API_KEY), magic link is printed to console."""
    with patch("app.services.email.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        mock_settings.frontend_url = "http://localhost:3000"
        mock_settings.email_from = "test@test.com"

        await send_magic_link_email("user@test.com", "token123")

        captured = capsys.readouterr()
        assert "token123" in captured.out
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_services/test_email.py -v`

Expected: FAIL

**Step 3: Implement email service**

Create `backend/app/services/email.py`:

```python
import resend

from app.config import settings


async def send_magic_link_email(to_email: str, token: str) -> None:
    magic_url = f"{settings.frontend_url}/auth/magic-link?token={token}"

    if not settings.resend_api_key:
        print(f"\n[DEV] Magic link for {to_email}: {magic_url}\n")
        return

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from,
            "to": [to_email],
            "subject": "Your WrapFlow login link",
            "html": (
                f"<p>Click the link below to log in:</p>"
                f'<p><a href="{magic_url}">Log in to WrapFlow</a></p>'
                f"<p>This link expires in 15 minutes.</p>"
            ),
        }
    )
```

**Step 4: Run test**

Run: `cd backend && uv run pytest tests/test_services/test_email.py -v`

Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/services/email.py backend/tests/test_services/
git commit -m "feat: add email service with Resend and dev console fallback"
```

---

### Task 11: Auth service (register, login, magic link, refresh)

**Files:**
- Create: `backend/app/services/auth.py`
- Create: `backend/tests/test_services/test_auth.py`

**Step 1: Write the failing tests**

Create `backend/tests/test_services/test_auth.py`:

```python
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.models.organization import Organization
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
        password="securepass123",
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
        email="dupe@shop.com", password="pass123", org_name="Shop 1"
    )
    with pytest.raises(ValueError, match="already registered"):
        await auth_service.register(
            email="dupe@shop.com", password="pass456", org_name="Shop 2"
        )


async def test_login(auth_service, default_plan):
    await auth_service.register(
        email="login@shop.com", password="mypassword", org_name="Login Shop"
    )
    result = await auth_service.login(email="login@shop.com", password="mypassword")
    assert "access_token" in result
    assert "refresh_token" in result


async def test_login_wrong_password(auth_service, default_plan):
    await auth_service.register(
        email="wrong@shop.com", password="correct", org_name="Wrong Shop"
    )
    with pytest.raises(ValueError, match="Invalid"):
        await auth_service.login(email="wrong@shop.com", password="incorrect")
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_services/test_auth.py -v`

Expected: FAIL

**Step 3: Implement auth service**

Create `backend/app/services/auth.py`:

```python
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token
from app.auth.passwords import hash_password, verify_password
from app.models.magic_link import MagicLink
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.refresh_token import RefreshToken
from app.models.user import Role, User


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def register(
        self, email: str, password: str, org_name: str
    ) -> dict[str, str]:
        existing = await self.session.execute(
            select(User).where(User.email == email)
        )
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")

        plan = await self.session.execute(
            select(Plan).where(Plan.is_default.is_(True))
        )
        plan = plan.scalar_one()

        org = Organization(
            id=uuid.uuid4(),
            name=org_name,
            slug=_slugify(org_name) + "-" + uuid.uuid4().hex[:6],
            plan_id=plan.id,
        )
        self.session.add(org)
        await self.session.flush()

        user = User(
            id=uuid.uuid4(),
            organization_id=org.id,
            email=email,
            password_hash=hash_password(password),
            role=Role.ADMIN,
        )
        self.session.add(user)
        await self.session.flush()

        tokens = await self._create_tokens(user)
        await self.session.commit()
        return tokens

    async def login(self, email: str, password: str) -> dict[str, str]:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        if not user or not user.password_hash:
            raise ValueError("Invalid email or password")
        if not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")

        tokens = await self._create_tokens(user)
        await self.session.commit()
        return tokens

    async def request_magic_link(self, email: str) -> str | None:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        if not user:
            return None

        token = secrets.token_urlsafe(32)
        link = MagicLink(
            id=uuid.uuid4(),
            user_id=user.id,
            token=token,
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
        )
        self.session.add(link)
        await self.session.commit()
        return token

    async def verify_magic_link(self, token: str) -> dict[str, str]:
        result = await self.session.execute(
            select(MagicLink).where(
                MagicLink.token == token,
                MagicLink.used_at.is_(None),
                MagicLink.expires_at > datetime.now(UTC),
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            raise ValueError("Invalid or expired magic link")

        link.used_at = datetime.now(UTC)

        result = await self.session.execute(
            select(User).where(User.id == link.user_id)
        )
        user = result.scalar_one()

        tokens = await self._create_tokens(user)
        await self.session.commit()
        return tokens

    async def refresh(self, refresh_token_str: str) -> dict[str, str]:
        result = await self.session.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token_str,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(UTC),
            )
        )
        token_record = result.scalar_one_or_none()
        if not token_record:
            raise ValueError("Invalid or expired refresh token")

        result = await self.session.execute(
            select(User).where(User.id == token_record.user_id)
        )
        user = result.scalar_one()

        access_token = create_access_token(
            user_id=user.id,
            organization_id=user.organization_id,
            role=user.role.value,
        )
        return {"access_token": access_token}

    async def logout(self, refresh_token_str: str) -> None:
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.token == refresh_token_str)
        )
        token_record = result.scalar_one_or_none()
        if token_record:
            token_record.revoked_at = datetime.now(UTC)
            await self.session.commit()

    async def _create_tokens(self, user: User) -> dict[str, str]:
        access_token = create_access_token(
            user_id=user.id,
            organization_id=user.organization_id,
            role=user.role.value,
        )
        refresh_token_str = create_refresh_token(user_id=user.id)

        refresh_record = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token=refresh_token_str,
            expires_at=datetime.now(UTC) + timedelta(days=30),
        )
        self.session.add(refresh_record)
        return {"access_token": access_token, "refresh_token": refresh_token_str}
```

**Step 4: Run tests**

Run: `cd backend && uv run pytest tests/test_services/test_auth.py -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add backend/app/services/auth.py backend/tests/test_services/test_auth.py
git commit -m "feat: add auth service with register, login, magic link, refresh"
```

---

### Task 12: Auth dependencies (get_current_user, get_tenant_session)

**Files:**
- Create: `backend/app/auth/dependencies.py`
- Create: `backend/tests/test_auth/test_dependencies.py`

**Step 1: Write the failing test**

Create `backend/tests/test_auth/test_dependencies.py`:

```python
import uuid

import pytest

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
    await db_session.commit()
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
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(token="bad.token.here", session=db_session)
    assert exc_info.value.status_code == 401
```

**Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_auth/test_dependencies.py -v`

Expected: FAIL

**Step 3: Implement dependencies**

Create `backend/app/auth/dependencies.py`:

```python
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
from app.db import async_session
from app.models.user import User

security = HTTPBearer()


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session


async def get_current_user(
    token: str | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    raw_token = token or (credentials.credentials if credentials else None)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    try:
        payload = decode_token(raw_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = uuid.UUID(payload["sub"])
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user
```

**Step 4: Run tests**

Run: `cd backend && uv run pytest tests/test_auth/test_dependencies.py -v`

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add backend/app/auth/dependencies.py backend/tests/test_auth/test_dependencies.py
git commit -m "feat: add get_current_user and get_session auth dependencies"
```

---

### Task 13: Auth API routes

**Files:**
- Create: `backend/app/routers/auth.py`
- Create: `backend/app/schemas/auth.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_routers/__init__.py`
- Create: `backend/tests/test_routers/test_auth.py`
- Create: `backend/tests/conftest_api.py` (shared API test fixtures)

**Step 1: Create Pydantic schemas**

Create `backend/app/schemas/auth.py`:

```python
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: str
    password: str
    org_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class MagicLinkRequest(BaseModel):
    email: str


class MagicLinkVerify(BaseModel):
    token: str


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None


class MessageResponse(BaseModel):
    message: str
```

**Step 2: Create the auth router**

Create `backend/app/routers/auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MagicLinkRequest,
    MagicLinkVerify,
    MessageResponse,
    RegisterRequest,
    TokenRefreshRequest,
    TokenResponse,
)
from app.services.auth import AuthService
from app.services.email import send_magic_link_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    service = AuthService(session)
    try:
        tokens = await service.register(
            email=body.email, password=body.password, org_name=body.org_name
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return tokens


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    service = AuthService(session)
    try:
        tokens = await service.login(email=body.email, password=body.password)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return tokens


@router.post("/magic-link/request", response_model=MessageResponse)
async def request_magic_link(
    body: MagicLinkRequest, session: AsyncSession = Depends(get_session)
):
    service = AuthService(session)
    token = await service.request_magic_link(email=body.email)
    if token:
        await send_magic_link_email(body.email, token)
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a magic link has been sent"}


@router.post("/magic-link/verify", response_model=TokenResponse)
async def verify_magic_link(
    body: MagicLinkVerify, session: AsyncSession = Depends(get_session)
):
    service = AuthService(session)
    try:
        tokens = await service.verify_magic_link(token=body.token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired magic link",
        )
    return tokens


@router.post("/token/refresh", response_model=TokenResponse)
async def refresh_token(
    body: TokenRefreshRequest, session: AsyncSession = Depends(get_session)
):
    service = AuthService(session)
    try:
        tokens = await service.refresh(refresh_token_str=body.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return tokens


@router.post("/logout", response_model=MessageResponse)
async def logout(
    body: TokenRefreshRequest, session: AsyncSession = Depends(get_session)
):
    service = AuthService(session)
    await service.logout(refresh_token_str=body.refresh_token)
    return {"message": "Logged out"}
```

**Step 3: Register router in main.py**

Replace `backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="WrapIQ API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Step 4: Write the failing API tests**

Create `backend/tests/test_routers/__init__.py` (empty) and `backend/tests/test_routers/test_auth.py`:

```python
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.main import app
from app.models.plan import Plan


@pytest.fixture
async def seed_plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.commit()
    return plan


@pytest.fixture
async def client(db_session, seed_plan):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def test_register(client):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "new@shop.com", "password": "pass123", "org_name": "New Shop"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_register_duplicate(client):
    await client.post(
        "/api/auth/register",
        json={"email": "dup@shop.com", "password": "pass", "org_name": "Shop"},
    )
    resp = await client.post(
        "/api/auth/register",
        json={"email": "dup@shop.com", "password": "pass", "org_name": "Shop 2"},
    )
    assert resp.status_code == 409


async def test_login(client):
    await client.post(
        "/api/auth/register",
        json={"email": "log@shop.com", "password": "mypass", "org_name": "Log Shop"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "log@shop.com", "password": "mypass"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_login_wrong_password(client):
    await client.post(
        "/api/auth/register",
        json={"email": "bad@shop.com", "password": "right", "org_name": "Bad Shop"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "bad@shop.com", "password": "wrong"},
    )
    assert resp.status_code == 401


async def test_refresh_token(client):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "ref@shop.com", "password": "pass", "org_name": "Ref Shop"},
    )
    refresh = reg.json()["refresh_token"]
    resp = await client.post(
        "/api/auth/token/refresh",
        json={"refresh_token": refresh},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_logout(client):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "out@shop.com", "password": "pass", "org_name": "Out Shop"},
    )
    refresh = reg.json()["refresh_token"]
    resp = await client.post(
        "/api/auth/logout",
        json={"refresh_token": refresh},
    )
    assert resp.status_code == 200

    # Refresh should now fail
    resp = await client.post(
        "/api/auth/token/refresh",
        json={"refresh_token": refresh},
    )
    assert resp.status_code == 401
```

**Step 5: Run API tests**

Run: `cd backend && uv run pytest tests/test_routers/test_auth.py -v`

Expected: PASS (6 tests)

**Step 6: Commit**

```bash
git add backend/app/routers/ backend/app/schemas/ backend/app/main.py backend/tests/
git commit -m "feat: add auth API routes (register, login, magic link, refresh, logout)"
```

---

### Task 14: Users /me endpoint

**Files:**
- Create: `backend/app/routers/users.py`
- Create: `backend/app/schemas/users.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_routers/test_users.py`

**Step 1: Create user schemas**

Create `backend/app/schemas/users.py`:

```python
import uuid

from pydantic import BaseModel

from app.models.user import Role


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    organization_id: uuid.UUID | None
    is_superadmin: bool

    model_config = {"from_attributes": True}
```

**Step 2: Create users router**

Create `backend/app/routers/users.py`:

```python
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.users import UserResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user
```

**Step 3: Register users router in main.py**

Add to `backend/app/main.py` after the auth router import:

```python
from app.routers.users import router as users_router
```

And after `app.include_router(auth_router)`:

```python
app.include_router(users_router)
```

**Step 4: Write the failing test**

Create `backend/tests/test_routers/test_users.py`:

```python
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
from app.models.plan import Plan


@pytest.fixture
async def seed_plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.commit()
    return plan


@pytest.fixture
async def client(db_session, seed_plan):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def test_get_me(client):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "me@shop.com", "password": "pass", "org_name": "My Shop"},
    )
    token = reg.json()["access_token"]
    resp = await client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@shop.com"
    assert data["role"] == "admin"
    assert data["is_superadmin"] is False


async def test_get_me_no_token(client):
    resp = await client.get("/api/users/me")
    assert resp.status_code == 403
```

**Step 5: Run test**

Run: `cd backend && uv run pytest tests/test_routers/test_users.py -v`

Expected: PASS (2 tests)

**Step 6: Commit**

```bash
git add backend/app/routers/users.py backend/app/schemas/users.py backend/app/main.py backend/tests/
git commit -m "feat: add GET /api/users/me endpoint"
```

---

### Task 15: Seed default free plan in migration

**Files:**
- Create: `backend/alembic/versions/002_seed_default_plan.py`

**Step 1: Create a data migration**

Run: `docker compose exec backend uv run alembic revision -m "seed default free plan"`

**Step 2: Edit the generated migration**

Replace the upgrade/downgrade functions:

```python
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

plan_id = uuid.uuid4()


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO plans (id, name, features, price_cents, is_default, created_at, updated_at)
            VALUES (:id, 'Free', '{"max_projects": 50, "max_users": 5}'::jsonb, 0, true, now(), now())
            """
        ).bindparams(id=str(plan_id))
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM plans WHERE name = 'Free' AND is_default = true"))
```

**Step 3: Run migration**

Run: `docker compose exec backend uv run alembic upgrade head`

**Step 4: Verify**

Run: `docker compose exec db psql -U postgres -d wrapiq -c "SELECT * FROM plans;"`

Expected: One row with name="Free", is_default=true.

**Step 5: Commit**

```bash
git add backend/alembic/
git commit -m "feat: seed default free plan in migration"
```

---

### Task 16: Run full test suite and verify

**Step 1: Run all tests**

Run: `cd backend && uv run pytest -v`

Expected: All tests pass.

**Step 2: Run linter**

Run: `cd backend && uv run ruff check app tests && uv run ruff format --check app tests`

Fix any issues found.

**Step 3: Run with Docker**

Run: `make rebuild && make up && make logs-backend`

Verify:
- Backend starts without errors
- Migrations run automatically
- `/health` returns `{"status": "ok"}`
- `/docs` shows all auth endpoints

**Step 4: Manual smoke test**

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@wrapshop.com","password":"test123","org_name":"Test Wrap Shop"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@wrapshop.com","password":"test123"}'

# Get me (use access_token from login response)
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer <access_token>"
```

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address lint and test issues from full verification"
```
