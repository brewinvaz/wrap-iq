# Superadmin Role & Admin Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add platform-level superadmin with org/user management, impersonation, metrics, and audit logging.

**Architecture:** New `require_superadmin` dependency, JWT claims for `is_superadmin` and `impersonating`, token-swap impersonation, dedicated `/api/superadmin/*` routes with service layer.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), PyJWT, pytest

---

## Task 1: JWT & Auth Changes

**Goal:** Add `is_superadmin` claim to JWT, fix `require_org_member()` superadmin bypass, add `require_superadmin` dependency.

### 1a. Modify `backend/app/auth/jwt.py`

Add `is_superadmin` and `impersonating` claims to `create_access_token`.

```python
import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings


def create_access_token(
    user_id: uuid.UUID,
    organization_id: uuid.UUID | None = None,
    role: str = "admin",
    is_superadmin: bool = False,
    impersonating: bool = False,
    real_user_id: uuid.UUID | None = None,
    expire_minutes: int | None = None,
) -> str:
    now = datetime.now(UTC)
    ttl = expire_minutes or settings.access_token_expire_minutes
    payload = {
        "sub": str(user_id),
        "org": str(organization_id) if organization_id else None,
        "role": role,
        "type": "access",
        "is_superadmin": is_superadmin,
        "impersonating": impersonating,
        "iat": now,
        "exp": now + timedelta(minutes=ttl),
    }
    if real_user_id is not None:
        payload["real_user_id"] = str(real_user_id)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(days=settings.refresh_token_expire_days),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
```

### 1b. Update `backend/app/services/auth.py` — pass `is_superadmin` to `create_access_token`

In `_create_tokens` and `refresh`, add the `is_superadmin` kwarg:

```python
# In _create_tokens method, change the create_access_token call to:
        access_token = create_access_token(
            user_id=user.id,
            organization_id=user.organization_id,
            role=user.role.value,
            is_superadmin=user.is_superadmin,
        )

# In refresh method, change the create_access_token call to:
        access_token = create_access_token(
            user_id=user.id,
            organization_id=user.organization_id,
            role=user.role.value,
            is_superadmin=user.is_superadmin,
        )
```

### 1c. Fix `require_org_member` in `backend/app/auth/permissions.py`

Add superadmin bypass and add the new `require_superadmin` dependency:

```python
import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.user import Role, User


def require_role(*roles: Role) -> Callable:
    """FastAPI dependency that checks user has one of the specified roles."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.is_superadmin:
            return user
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return checker


require_admin = require_role(Role.ADMIN)


async def require_org_member(
    user: User = Depends(get_current_user),
) -> User:
    """Ensures user belongs to an organization. Superadmins bypass."""
    if user.is_superadmin:
        return user
    if user.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of any organization",
        )
    return user


async def require_superadmin(
    user: User = Depends(get_current_user),
) -> User:
    """Ensures user is a superadmin. Returns 403 otherwise."""
    if not user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required",
        )
    return user


def require_same_org(target_org_id: uuid.UUID) -> Callable:
    """Ensures user belongs to the specified organization."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.is_superadmin:
            return user
        if user.organization_id != target_org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this organization",
            )
        return user

    return checker
```

### 1d. Tests — `backend/tests/test_auth/test_permissions.py`

Add tests for the new `require_superadmin` dependency and the fixed `require_org_member`. Append these tests to the existing file:

```python
# Add import at top:
from app.auth.permissions import require_superadmin

# Add these tests:

async def test_require_org_member_allows_superadmin_without_org():
    user = make_user(org_id=None, is_superadmin=True)
    result = await require_org_member(user=user)
    assert result.is_superadmin is True


async def test_require_superadmin_allows_superadmin():
    user = make_user(org_id=None, is_superadmin=True)
    result = await require_superadmin(user=user)
    assert result.is_superadmin is True


async def test_require_superadmin_denies_regular_user(org):
    user = make_user(org_id=org.id, role=Role.ADMIN, is_superadmin=False)
    with pytest.raises(HTTPException) as exc_info:
        await require_superadmin(user=user)
    assert exc_info.value.status_code == 403
```

### 1e. Tests — `backend/tests/test_auth/test_jwt.py`

Create this new file to test JWT claim changes:

```python
import uuid

from app.auth.jwt import create_access_token, decode_token


def test_access_token_includes_superadmin_claim():
    uid = uuid.uuid4()
    token = create_access_token(user_id=uid, is_superadmin=True)
    payload = decode_token(token)
    assert payload["is_superadmin"] is True
    assert payload["impersonating"] is False


def test_access_token_default_superadmin_false():
    uid = uuid.uuid4()
    token = create_access_token(user_id=uid)
    payload = decode_token(token)
    assert payload["is_superadmin"] is False
    assert payload["impersonating"] is False


def test_impersonation_token_claims():
    uid = uuid.uuid4()
    org_id = uuid.uuid4()
    token = create_access_token(
        user_id=uid,
        organization_id=org_id,
        role="admin",
        is_superadmin=True,
        impersonating=True,
        real_user_id=uid,
        expire_minutes=60,
    )
    payload = decode_token(token)
    assert payload["is_superadmin"] is True
    assert payload["impersonating"] is True
    assert payload["real_user_id"] == str(uid)
    assert payload["org"] == str(org_id)
```

### Run & verify

```bash
cd backend && uv run ruff check app/auth/jwt.py app/auth/permissions.py app/services/auth.py && uv run ruff format app/auth/jwt.py app/auth/permissions.py app/services/auth.py
cd backend && uv run pytest tests/test_auth/test_permissions.py tests/test_auth/test_jwt.py -v
```

### Commit

```bash
git add backend/app/auth/jwt.py backend/app/auth/permissions.py backend/app/services/auth.py backend/tests/test_auth/test_permissions.py backend/tests/test_auth/test_jwt.py
git commit -m "$(cat <<'EOF'
feat(auth): add superadmin JWT claims, require_superadmin dependency, fix require_org_member bypass

- Add is_superadmin, impersonating, real_user_id claims to access tokens
- Add require_superadmin dependency for superadmin-only routes
- Fix require_org_member to bypass for superadmins (no org needed)
- Pass is_superadmin through auth service token creation
- Add tests for all new auth behavior

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add ActionType Enum Values

**Goal:** Add `IMPERSONATION_STARTED`, `IMPERSONATION_STOPPED`, `SUPERADMIN_ACTION` to the ActionType enum.

### Modify `backend/app/models/audit_log.py`

```python
import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class ActionType(enum.StrEnum):
    # Project/Work Order actions
    PROJECT_CREATED = "project_created"
    PROJECT_UPDATED = "project_updated"
    PROJECT_DELETED = "project_deleted"
    STATUS_CHANGED = "status_changed"

    # User management actions
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DEACTIVATED = "user_deactivated"

    # Organization/billing actions
    ORG_UPDATED = "org_updated"
    BILLING_UPDATED = "billing_updated"

    # System events
    SYSTEM_EVENT = "system_event"

    # Superadmin actions
    IMPERSONATION_STARTED = "impersonation_started"
    IMPERSONATION_STOPPED = "impersonation_stopped"
    SUPERADMIN_ACTION = "superadmin_action"


class AuditLog(Base, TenantMixin, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True, nullable=True
    )
    action: Mapped[ActionType] = mapped_column(Enum(ActionType), index=True)
    resource_type: Mapped[str] = mapped_column(String(100), index=True)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    user = relationship("User", lazy="selectin")
```

### Update `backend/tests/conftest.py`

The root conftest drops and re-creates the `actiontype` enum type. No changes needed since it already drops `actiontype` CASCADE. The new enum values will be picked up automatically when `Base.metadata.create_all` runs.

### Run & verify

```bash
cd backend && uv run ruff check app/models/audit_log.py && uv run ruff format app/models/audit_log.py
cd backend && uv run pytest tests/test_auth/test_permissions.py -v --co  # just collect to verify no import errors
```

### Commit

```bash
git add backend/app/models/audit_log.py
git commit -m "$(cat <<'EOF'
feat(models): add superadmin ActionType enum values

Add IMPERSONATION_STARTED, IMPERSONATION_STOPPED, SUPERADMIN_ACTION
to the ActionType enum for audit logging of superadmin operations.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Audit Log Service Cross-Org Query

**Goal:** Add `list_all_logs()` method to `AuditLogService` for cross-org audit log queries.

### Modify `backend/app/services/audit_log.py`

```python
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import ActionType, AuditLog


class AuditLogService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_log(
        self,
        organization_id: uuid.UUID,
        action: ActionType,
        resource_type: str,
        resource_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        details: dict | None = None,
    ) -> AuditLog:
        log = AuditLog(
            id=uuid.uuid4(),
            organization_id=organization_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
        )
        self.session.add(log)
        await self.session.flush()
        return log

    async def list_logs(
        self,
        organization_id: uuid.UUID,
        action: ActionType | None = None,
        resource_type: str | None = None,
        resource_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        query = select(AuditLog).where(AuditLog.organization_id == organization_id)
        count_query = (
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.organization_id == organization_id)
        )

        if action is not None:
            query = query.where(AuditLog.action == action)
            count_query = count_query.where(AuditLog.action == action)

        if resource_type is not None:
            query = query.where(AuditLog.resource_type == resource_type)
            count_query = count_query.where(AuditLog.resource_type == resource_type)

        if resource_id is not None:
            query = query.where(AuditLog.resource_id == resource_id)
            count_query = count_query.where(AuditLog.resource_id == resource_id)

        if user_id is not None:
            query = query.where(AuditLog.user_id == user_id)
            count_query = count_query.where(AuditLog.user_id == user_id)

        query = query.order_by(AuditLog.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        logs = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()

        return logs, total

    async def list_all_logs(
        self,
        organization_id: uuid.UUID | None = None,
        action: ActionType | None = None,
        user_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        """Cross-org audit log query for superadmins. No mandatory org filter."""
        query = select(AuditLog)
        count_query = select(func.count()).select_from(AuditLog)

        if organization_id is not None:
            query = query.where(AuditLog.organization_id == organization_id)
            count_query = count_query.where(
                AuditLog.organization_id == organization_id
            )

        if action is not None:
            query = query.where(AuditLog.action == action)
            count_query = count_query.where(AuditLog.action == action)

        if user_id is not None:
            query = query.where(AuditLog.user_id == user_id)
            count_query = count_query.where(AuditLog.user_id == user_id)

        query = query.order_by(AuditLog.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        logs = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()

        return logs, total
```

### Test — `backend/tests/test_services/test_audit_log_service.py`

Create this new test file:

```python
import uuid

import pytest

from app.models.audit_log import ActionType
from app.models.organization import Organization
from app.models.plan import Plan
from app.services.audit_log import AuditLogService


@pytest.fixture
async def plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    return plan


@pytest.fixture
async def orgs(db_session, plan):
    org_a = Organization(
        id=uuid.uuid4(), name="Org A", slug="org-a", plan_id=plan.id
    )
    org_b = Organization(
        id=uuid.uuid4(), name="Org B", slug="org-b", plan_id=plan.id
    )
    db_session.add_all([org_a, org_b])
    await db_session.flush()
    return {"a": org_a, "b": org_b}


@pytest.fixture
async def audit_service(db_session):
    return AuditLogService(db_session)


async def test_list_all_logs_returns_cross_org(db_session, orgs, audit_service):
    await audit_service.create_log(
        organization_id=orgs["a"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await audit_service.create_log(
        organization_id=orgs["b"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await db_session.commit()

    logs, total = await audit_service.list_all_logs()
    assert total == 2
    assert len(logs) == 2


async def test_list_all_logs_filters_by_org(db_session, orgs, audit_service):
    await audit_service.create_log(
        organization_id=orgs["a"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await audit_service.create_log(
        organization_id=orgs["b"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await db_session.commit()

    logs, total = await audit_service.list_all_logs(organization_id=orgs["a"].id)
    assert total == 1
    assert logs[0].organization_id == orgs["a"].id


async def test_list_all_logs_filters_by_action(db_session, orgs, audit_service):
    await audit_service.create_log(
        organization_id=orgs["a"].id,
        action=ActionType.USER_CREATED,
        resource_type="user",
    )
    await audit_service.create_log(
        organization_id=orgs["a"].id,
        action=ActionType.SUPERADMIN_ACTION,
        resource_type="organization",
    )
    await db_session.commit()

    logs, total = await audit_service.list_all_logs(
        action=ActionType.SUPERADMIN_ACTION
    )
    assert total == 1
    assert logs[0].action == ActionType.SUPERADMIN_ACTION


async def test_list_all_logs_pagination(db_session, orgs, audit_service):
    for _ in range(5):
        await audit_service.create_log(
            organization_id=orgs["a"].id,
            action=ActionType.USER_CREATED,
            resource_type="user",
        )
    await db_session.commit()

    logs, total = await audit_service.list_all_logs(limit=2, offset=0)
    assert total == 5
    assert len(logs) == 2

    logs, total = await audit_service.list_all_logs(limit=2, offset=4)
    assert total == 5
    assert len(logs) == 1
```

### Run & verify

```bash
cd backend && uv run ruff check app/services/audit_log.py tests/test_services/test_audit_log_service.py && uv run ruff format app/services/audit_log.py tests/test_services/test_audit_log_service.py
cd backend && uv run pytest tests/test_services/test_audit_log_service.py -v
```

### Commit

```bash
git add backend/app/services/audit_log.py backend/tests/test_services/test_audit_log_service.py
git commit -m "$(cat <<'EOF'
feat(audit): add list_all_logs cross-org query for superadmin

Add list_all_logs() method to AuditLogService that queries across all
organizations with optional org_id, action, and user_id filters.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: CLI Seed Superadmin Command

**Goal:** Create `app/cli/seed_superadmin.py` that seeds a superadmin user from environment variables.

### Create `backend/app/cli/__init__.py`

```python
```

(Empty file, just makes it a package.)

### Create `backend/app/cli/seed_superadmin.py`

```python
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

from app.auth.passwords import hash_password
from app.config import settings
from app.db import Base
from app.models.user import Role, User

# Import all models so Base.metadata is populated
import app.models  # noqa: F401


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
```

### Create `backend/app/cli/__main__.py`

```python
from app.cli.seed_superadmin import main

main()
```

### Test — `backend/tests/test_cli/test_seed_superadmin.py`

```python
import uuid

import pytest
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
```

### Run & verify

```bash
cd backend && uv run ruff check app/cli/ tests/test_cli/ && uv run ruff format app/cli/ tests/test_cli/
cd backend && uv run pytest tests/test_cli/test_seed_superadmin.py -v
```

### Commit

```bash
git add backend/app/cli/__init__.py backend/app/cli/__main__.py backend/app/cli/seed_superadmin.py backend/tests/test_cli/test_seed_superadmin.py
git commit -m "$(cat <<'EOF'
feat(cli): add seed_superadmin command

CLI command to create or upgrade a superadmin user from
SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD env vars. Idempotent.

Usage: uv run python -m app.cli.seed_superadmin

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Superadmin Schemas

**Goal:** Create Pydantic schemas for all superadmin endpoints.

### Create `backend/app/schemas/superadmin.py`

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.audit_log import ActionType
from app.models.user import Role


# ── Org schemas ──────────────────────────────────────────────────────


class OrgListParams(BaseModel):
    search: str | None = None
    limit: int = 50
    offset: int = 0


class OrgCreateRequest(BaseModel):
    name: str
    plan_id: uuid.UUID
    is_active: bool = True


class OrgUpdateRequest(BaseModel):
    name: str | None = None
    plan_id: uuid.UUID | None = None
    is_active: bool | None = None


class OrgResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrgDetailResponse(OrgResponse):
    user_count: int
    work_order_count: int


class OrgListResponse(BaseModel):
    items: list[OrgResponse]
    total: int


# ── User schemas ─────────────────────────────────────────────────────


class UserListParams(BaseModel):
    organization_id: uuid.UUID | None = None
    role: Role | None = None
    is_active: bool | None = None
    limit: int = 50
    offset: int = 0


class SuperadminUserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    is_superadmin: bool = True


class SuperadminUserUpdateRequest(BaseModel):
    role: Role | None = None
    is_active: bool | None = None
    is_superadmin: bool | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    organization_id: uuid.UUID | None
    is_active: bool
    is_superadmin: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int


# ── Metrics schemas ──────────────────────────────────────────────────


class PlanCount(BaseModel):
    plan_name: str
    count: int


class RecentSignup(BaseModel):
    org_name: str
    created_at: datetime


class MetricsResponse(BaseModel):
    total_organizations: int
    total_users: int
    total_work_orders: int
    orgs_by_plan: list[PlanCount]
    recent_signups: list[RecentSignup]


# ── Audit log schemas ───────────────────────────────────────────────


class AuditLogParams(BaseModel):
    organization_id: uuid.UUID | None = None
    action: ActionType | None = None
    user_id: uuid.UUID | None = None
    limit: int = 50
    offset: int = 0


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID | None
    action: ActionType
    resource_type: str
    resource_id: uuid.UUID | None
    details: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int


# ── Impersonation schemas ───────────────────────────────────────────


class ImpersonationResponse(BaseModel):
    access_token: str
    organization_id: uuid.UUID
    impersonating: bool = True


class StopImpersonationResponse(BaseModel):
    access_token: str
    impersonating: bool = False
```

### Run & verify

```bash
cd backend && uv run ruff check app/schemas/superadmin.py && uv run ruff format app/schemas/superadmin.py
cd backend && uv run python -c "from app.schemas.superadmin import *; print('All schemas imported OK')"
```

### Commit

```bash
git add backend/app/schemas/superadmin.py
git commit -m "$(cat <<'EOF'
feat(schemas): add Pydantic schemas for superadmin endpoints

Schemas for org CRUD, user management, platform metrics,
cross-org audit logs, and impersonation token responses.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Superadmin Service

**Goal:** Business logic for org management, user management, metrics, and impersonation.

### Create `backend/app/services/superadmin.py`

```python
import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.auth.passwords import hash_password
from app.models.audit_log import ActionType
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User
from app.models.work_order import WorkOrder
from app.services.audit_log import AuditLogService


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug + "-" + uuid.uuid4().hex[:6]


class SuperadminService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.audit = AuditLogService(session)

    # ── Org management ───────────────────────────────────────────────

    async def list_orgs(
        self,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Organization], int]:
        query = select(Organization)
        count_query = select(func.count()).select_from(Organization)

        if search:
            query = query.where(Organization.name.ilike(f"%{search}%"))
            count_query = count_query.where(Organization.name.ilike(f"%{search}%"))

        query = query.order_by(Organization.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        orgs = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()

        return orgs, total

    async def get_org_detail(self, org_id: uuid.UUID) -> dict:
        result = await self.session.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            return None

        user_count_result = await self.session.execute(
            select(func.count())
            .select_from(User)
            .where(User.organization_id == org_id)
        )
        user_count = user_count_result.scalar_one()

        wo_count_result = await self.session.execute(
            select(func.count())
            .select_from(WorkOrder)
            .where(WorkOrder.organization_id == org_id)
        )
        work_order_count = wo_count_result.scalar_one()

        return {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "plan_id": org.plan_id,
            "is_active": org.is_active,
            "created_at": org.created_at,
            "updated_at": org.updated_at,
            "user_count": user_count,
            "work_order_count": work_order_count,
        }

    async def create_org(
        self,
        name: str,
        plan_id: uuid.UUID,
        is_active: bool,
        superadmin_id: uuid.UUID,
    ) -> Organization:
        org = Organization(
            id=uuid.uuid4(),
            name=name,
            slug=_slugify(name),
            plan_id=plan_id,
            is_active=is_active,
        )
        self.session.add(org)
        await self.session.flush()

        await self.audit.create_log(
            organization_id=org.id,
            action=ActionType.SUPERADMIN_ACTION,
            resource_type="organization",
            resource_id=org.id,
            user_id=superadmin_id,
            details={"action": "org_created", "name": name},
        )
        return org

    async def update_org(
        self,
        org_id: uuid.UUID,
        superadmin_id: uuid.UUID,
        name: str | None = None,
        plan_id: uuid.UUID | None = None,
        is_active: bool | None = None,
    ) -> Organization | None:
        result = await self.session.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            return None

        changes = {}
        if name is not None:
            org.name = name
            changes["name"] = name
        if plan_id is not None:
            org.plan_id = plan_id
            changes["plan_id"] = str(plan_id)
        if is_active is not None:
            org.is_active = is_active
            changes["is_active"] = is_active

        await self.audit.create_log(
            organization_id=org.id,
            action=ActionType.SUPERADMIN_ACTION,
            resource_type="organization",
            resource_id=org.id,
            user_id=superadmin_id,
            details={"action": "org_updated", "changes": changes},
        )
        await self.session.flush()
        return org

    # ── User management ──────────────────────────────────────────────

    async def list_users(
        self,
        organization_id: uuid.UUID | None = None,
        role: Role | None = None,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        query = select(User)
        count_query = select(func.count()).select_from(User)

        if organization_id is not None:
            query = query.where(User.organization_id == organization_id)
            count_query = count_query.where(
                User.organization_id == organization_id
            )

        if role is not None:
            query = query.where(User.role == role)
            count_query = count_query.where(User.role == role)

        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)

        query = query.order_by(User.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        users = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()

        return users, total

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def update_user(
        self,
        user_id: uuid.UUID,
        superadmin_id: uuid.UUID,
        role: Role | None = None,
        is_active: bool | None = None,
        is_superadmin: bool | None = None,
    ) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            return None

        changes = {}
        if role is not None:
            user.role = role
            changes["role"] = role.value
        if is_active is not None:
            user.is_active = is_active
            changes["is_active"] = is_active
        if is_superadmin is not None:
            user.is_superadmin = is_superadmin
            changes["is_superadmin"] = is_superadmin

        # Log to the user's org (or a placeholder UUID for orgless users)
        org_id = user.organization_id or uuid.UUID(int=0)
        await self.audit.create_log(
            organization_id=org_id,
            action=ActionType.SUPERADMIN_ACTION,
            resource_type="user",
            resource_id=user.id,
            user_id=superadmin_id,
            details={"action": "user_updated", "changes": changes},
        )
        await self.session.flush()
        return user

    async def create_superadmin_user(
        self,
        email: str,
        password: str,
        superadmin_id: uuid.UUID,
        is_superadmin: bool = True,
    ) -> User:
        # Check for existing email
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        if result.scalar_one_or_none():
            raise ValueError("Email already registered")

        user = User(
            id=uuid.uuid4(),
            organization_id=None,
            email=email,
            password_hash=hash_password(password),
            role=Role.ADMIN,
            is_superadmin=is_superadmin,
        )
        self.session.add(user)
        await self.session.flush()

        # Use placeholder org for orgless audit log
        await self.audit.create_log(
            organization_id=uuid.UUID(int=0),
            action=ActionType.SUPERADMIN_ACTION,
            resource_type="user",
            resource_id=user.id,
            user_id=superadmin_id,
            details={"action": "superadmin_user_created", "email": email},
        )
        return user

    # ── Metrics ──────────────────────────────────────────────────────

    async def get_metrics(self) -> dict:
        total_orgs = (
            await self.session.execute(
                select(func.count()).select_from(Organization)
            )
        ).scalar_one()

        total_users = (
            await self.session.execute(
                select(func.count()).select_from(User)
            )
        ).scalar_one()

        total_work_orders = (
            await self.session.execute(
                select(func.count()).select_from(WorkOrder)
            )
        ).scalar_one()

        # Orgs grouped by plan
        orgs_by_plan_query = (
            select(Plan.name, func.count(Organization.id))
            .join(Organization, Organization.plan_id == Plan.id)
            .group_by(Plan.name)
        )
        orgs_by_plan_result = await self.session.execute(orgs_by_plan_query)
        orgs_by_plan = [
            {"plan_name": row[0], "count": row[1]}
            for row in orgs_by_plan_result.all()
        ]

        # Recent signups (last 10 orgs)
        recent_query = (
            select(Organization.name, Organization.created_at)
            .order_by(Organization.created_at.desc())
            .limit(10)
        )
        recent_result = await self.session.execute(recent_query)
        recent_signups = [
            {"org_name": row[0], "created_at": row[1]}
            for row in recent_result.all()
        ]

        return {
            "total_organizations": total_orgs,
            "total_users": total_users,
            "total_work_orders": total_work_orders,
            "orgs_by_plan": orgs_by_plan,
            "recent_signups": recent_signups,
        }

    # ── Impersonation ────────────────────────────────────────────────

    async def start_impersonation(
        self,
        superadmin: User,
        org_id: uuid.UUID,
    ) -> dict:
        result = await self.session.execute(
            select(Organization).where(
                Organization.id == org_id,
                Organization.is_active.is_(True),
            )
        )
        org = result.scalar_one_or_none()
        if not org:
            return None

        token = create_access_token(
            user_id=superadmin.id,
            organization_id=org.id,
            role="admin",
            is_superadmin=True,
            impersonating=True,
            real_user_id=superadmin.id,
            expire_minutes=60,
        )

        await self.audit.create_log(
            organization_id=org.id,
            action=ActionType.IMPERSONATION_STARTED,
            resource_type="organization",
            resource_id=org.id,
            user_id=superadmin.id,
            details={"real_user_id": str(superadmin.id)},
        )
        await self.session.flush()

        return {
            "access_token": token,
            "organization_id": org.id,
            "impersonating": True,
        }

    async def stop_impersonation(self, superadmin: User) -> dict:
        token = create_access_token(
            user_id=superadmin.id,
            organization_id=None,
            role="admin",
            is_superadmin=True,
            impersonating=False,
        )

        # Log to placeholder org since superadmin has no org
        await self.audit.create_log(
            organization_id=uuid.UUID(int=0),
            action=ActionType.IMPERSONATION_STOPPED,
            resource_type="user",
            resource_id=superadmin.id,
            user_id=superadmin.id,
            details={"real_user_id": str(superadmin.id)},
        )
        await self.session.flush()

        return {
            "access_token": token,
            "impersonating": False,
        }
```

### Test — `backend/tests/test_services/test_superadmin_service.py`

```python
import uuid

import pytest

from app.auth.passwords import hash_password
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User
from app.services.superadmin import SuperadminService


@pytest.fixture
async def plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    return plan


@pytest.fixture
async def org(db_session, plan):
    org = Organization(
        id=uuid.uuid4(), name="Test Org", slug="test-org", plan_id=plan.id
    )
    db_session.add(org)
    await db_session.flush()
    return org


@pytest.fixture
async def superadmin(db_session):
    user = User(
        id=uuid.uuid4(),
        organization_id=None,
        email="sa@test.com",
        password_hash=hash_password("pass"),
        role=Role.ADMIN,
        is_superadmin=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def service(db_session):
    return SuperadminService(db_session)


async def test_list_orgs(db_session, org, service):
    orgs, total = await service.list_orgs()
    assert total == 1
    assert orgs[0].id == org.id


async def test_list_orgs_search(db_session, org, service):
    orgs, total = await service.list_orgs(search="Test")
    assert total == 1

    orgs, total = await service.list_orgs(search="Nonexistent")
    assert total == 0


async def test_get_org_detail(db_session, org, service):
    detail = await service.get_org_detail(org.id)
    assert detail["id"] == org.id
    assert detail["user_count"] == 0
    assert detail["work_order_count"] == 0


async def test_get_org_detail_not_found(db_session, service):
    detail = await service.get_org_detail(uuid.uuid4())
    assert detail is None


async def test_create_org(db_session, plan, superadmin, service):
    org = await service.create_org(
        name="New Org",
        plan_id=plan.id,
        is_active=True,
        superadmin_id=superadmin.id,
    )
    assert org.name == "New Org"
    assert org.is_active is True


async def test_update_org(db_session, org, superadmin, service):
    updated = await service.update_org(
        org_id=org.id,
        superadmin_id=superadmin.id,
        name="Renamed",
        is_active=False,
    )
    assert updated.name == "Renamed"
    assert updated.is_active is False


async def test_update_org_not_found(db_session, superadmin, service):
    result = await service.update_org(
        org_id=uuid.uuid4(),
        superadmin_id=superadmin.id,
        name="X",
    )
    assert result is None


async def test_list_users(db_session, org, superadmin, service):
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="u@test.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add(user)
    await db_session.flush()

    users, total = await service.list_users()
    assert total == 2  # superadmin + user


async def test_list_users_filter_by_org(db_session, org, superadmin, service):
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="u2@test.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add(user)
    await db_session.flush()

    users, total = await service.list_users(organization_id=org.id)
    assert total == 1
    assert users[0].email == "u2@test.com"


async def test_get_user(db_session, superadmin, service):
    user = await service.get_user(superadmin.id)
    assert user.email == "sa@test.com"


async def test_get_user_not_found(db_session, service):
    user = await service.get_user(uuid.uuid4())
    assert user is None


async def test_update_user(db_session, org, superadmin, service):
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="target@test.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add(user)
    await db_session.flush()

    updated = await service.update_user(
        user_id=user.id,
        superadmin_id=superadmin.id,
        role=Role.PROJECT_MANAGER,
        is_active=False,
    )
    assert updated.role == Role.PROJECT_MANAGER
    assert updated.is_active is False


async def test_create_superadmin_user(db_session, superadmin, service):
    user = await service.create_superadmin_user(
        email="new-sa@test.com",
        password="pass123",
        superadmin_id=superadmin.id,
    )
    assert user.is_superadmin is True
    assert user.organization_id is None


async def test_create_superadmin_user_duplicate_email(db_session, superadmin, service):
    with pytest.raises(ValueError, match="Email already registered"):
        await service.create_superadmin_user(
            email="sa@test.com",
            password="pass",
            superadmin_id=superadmin.id,
        )


async def test_get_metrics(db_session, org, superadmin, service):
    metrics = await service.get_metrics()
    assert metrics["total_organizations"] == 1
    assert metrics["total_users"] >= 1
    assert metrics["total_work_orders"] == 0
    assert isinstance(metrics["orgs_by_plan"], list)
    assert isinstance(metrics["recent_signups"], list)


async def test_start_impersonation(db_session, org, superadmin, service):
    result = await service.start_impersonation(superadmin, org.id)
    assert result is not None
    assert result["impersonating"] is True
    assert result["organization_id"] == org.id
    assert "access_token" in result


async def test_start_impersonation_inactive_org(db_session, plan, superadmin, service):
    inactive = Organization(
        id=uuid.uuid4(),
        name="Inactive",
        slug="inactive",
        plan_id=plan.id,
        is_active=False,
    )
    db_session.add(inactive)
    await db_session.flush()

    result = await service.start_impersonation(superadmin, inactive.id)
    assert result is None


async def test_start_impersonation_nonexistent_org(db_session, superadmin, service):
    result = await service.start_impersonation(superadmin, uuid.uuid4())
    assert result is None


async def test_stop_impersonation(db_session, superadmin, service):
    result = await service.stop_impersonation(superadmin)
    assert result["impersonating"] is False
    assert "access_token" in result
```

### Run & verify

```bash
cd backend && uv run ruff check app/services/superadmin.py tests/test_services/test_superadmin_service.py && uv run ruff format app/services/superadmin.py tests/test_services/test_superadmin_service.py
cd backend && uv run pytest tests/test_services/test_superadmin_service.py -v
```

### Commit

```bash
git add backend/app/services/superadmin.py backend/tests/test_services/test_superadmin_service.py
git commit -m "$(cat <<'EOF'
feat(services): add SuperadminService for org/user/metrics/impersonation

Business logic for superadmin org CRUD, cross-org user management,
platform metrics, and token-swap impersonation with audit logging.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Superadmin Router

**Goal:** Create all `/api/superadmin/*` endpoints.

### Create `backend/app/routers/superadmin.py`

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.auth.permissions import require_superadmin
from app.models.audit_log import ActionType
from app.models.user import Role, User
from app.schemas.superadmin import (
    AuditLogListResponse,
    AuditLogResponse,
    ImpersonationResponse,
    MetricsResponse,
    OrgCreateRequest,
    OrgDetailResponse,
    OrgListResponse,
    OrgResponse,
    OrgUpdateRequest,
    StopImpersonationResponse,
    SuperadminUserCreateRequest,
    SuperadminUserUpdateRequest,
    UserListResponse,
    UserResponse,
)
from app.services.audit_log import AuditLogService
from app.services.superadmin import SuperadminService

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


# ── Org management ───────────────────────────────────────────────────


@router.get("/orgs", response_model=OrgListResponse)
async def list_orgs(
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """List all organizations (paginated, search by name)."""
    service = SuperadminService(session)
    orgs, total = await service.list_orgs(search=search, limit=limit, offset=offset)
    return {"items": orgs, "total": total}


@router.get("/orgs/{org_id}", response_model=OrgDetailResponse)
async def get_org(
    org_id: uuid.UUID,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Get organization detail with user/work-order counts."""
    service = SuperadminService(session)
    detail = await service.get_org_detail(org_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )
    return detail


@router.post("/orgs", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
async def create_org(
    body: OrgCreateRequest,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Create an organization."""
    service = SuperadminService(session)
    org = await service.create_org(
        name=body.name,
        plan_id=body.plan_id,
        is_active=body.is_active,
        superadmin_id=admin.id,
    )
    await session.commit()
    await session.refresh(org)
    return org


@router.patch("/orgs/{org_id}", response_model=OrgResponse)
async def update_org(
    org_id: uuid.UUID,
    body: OrgUpdateRequest,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Update an organization (name, plan_id, is_active)."""
    service = SuperadminService(session)
    org = await service.update_org(
        org_id=org_id,
        superadmin_id=admin.id,
        name=body.name,
        plan_id=body.plan_id,
        is_active=body.is_active,
    )
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found"
        )
    await session.commit()
    await session.refresh(org)
    return org


# ── User management ─────────────────────────────────────────────────


@router.get("/users", response_model=UserListResponse)
async def list_users(
    organization_id: uuid.UUID | None = Query(None),
    role: Role | None = Query(None),
    is_active: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """List users across all organizations."""
    service = SuperadminService(session)
    users, total = await service.list_users(
        organization_id=organization_id,
        role=role,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )
    return {"items": users, "total": total}


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Get user detail."""
    service = SuperadminService(session)
    user = await service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: SuperadminUserUpdateRequest,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Update a user (role, is_active, is_superadmin)."""
    service = SuperadminService(session)
    user = await service.update_user(
        user_id=user_id,
        superadmin_id=admin.id,
        role=body.role,
        is_active=body.is_active,
        is_superadmin=body.is_superadmin,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    await session.commit()
    await session.refresh(user)
    return user


@router.post(
    "/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def create_superadmin_user(
    body: SuperadminUserCreateRequest,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Create a new superadmin user (no org)."""
    service = SuperadminService(session)
    try:
        user = await service.create_superadmin_user(
            email=body.email,
            password=body.password,
            superadmin_id=admin.id,
            is_superadmin=body.is_superadmin,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    await session.commit()
    await session.refresh(user)
    return user


# ── Metrics ──────────────────────────────────────────────────────────


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Get platform-wide metrics."""
    service = SuperadminService(session)
    return await service.get_metrics()


# ── Audit logs ───────────────────────────────────────────────────────


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    organization_id: uuid.UUID | None = Query(None),
    action: ActionType | None = Query(None),
    user_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Cross-org audit logs."""
    service = AuditLogService(session)
    logs, total = await service.list_all_logs(
        organization_id=organization_id,
        action=action,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    return {"items": logs, "total": total}


# ── Impersonation ───────────────────────────────────────────────────


@router.post("/impersonate/{org_id}", response_model=ImpersonationResponse)
async def start_impersonation(
    org_id: uuid.UUID,
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Start impersonating an organization."""
    service = SuperadminService(session)
    result = await service.start_impersonation(admin, org_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive",
        )
    await session.commit()
    return result


@router.post("/stop-impersonation", response_model=StopImpersonationResponse)
async def stop_impersonation(
    admin: User = Depends(require_superadmin),
    session: AsyncSession = Depends(get_session),
):
    """Stop impersonation and return to normal superadmin token."""
    service = SuperadminService(session)
    result = await service.stop_impersonation(admin)
    await session.commit()
    return result
```

### Test — `backend/tests/test_routers/test_superadmin_routes.py`

```python
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.auth.jwt import create_access_token
from app.main import app
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


@pytest.fixture
async def seed_data(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(
        id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id
    )
    db_session.add(org)
    await db_session.flush()

    superadmin = User(
        id=uuid.uuid4(),
        organization_id=None,
        email="sa@wrapflow.io",
        password_hash="hashed",
        role=Role.ADMIN,
        is_superadmin=True,
    )
    regular_admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
        is_superadmin=False,
    )
    installer = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="installer@shop.com",
        password_hash="hashed",
        role=Role.INSTALLER,
        is_superadmin=False,
    )
    db_session.add_all([superadmin, regular_admin, installer])
    await db_session.commit()

    return {
        "plan": plan,
        "org": org,
        "superadmin": superadmin,
        "regular_admin": regular_admin,
        "installer": installer,
    }


@pytest.fixture
async def client(db_session, seed_data):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def make_token(user: User, **kwargs) -> dict:
    token = create_access_token(
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
        is_superadmin=user.is_superadmin,
        **kwargs,
    )
    return {"Authorization": f"Bearer {token}"}


# ── Auth guard tests ─────────────────────────────────────────────────


async def test_non_superadmin_gets_403(client, seed_data):
    headers = make_token(seed_data["regular_admin"])
    resp = await client.get("/api/superadmin/orgs", headers=headers)
    assert resp.status_code == 403


async def test_unauthenticated_gets_401(client):
    resp = await client.get("/api/superadmin/orgs")
    assert resp.status_code in (401, 403)


# ── Org endpoints ────────────────────────────────────────────────────


async def test_list_orgs(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get("/api/superadmin/orgs", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Shop"


async def test_list_orgs_search(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get(
        "/api/superadmin/orgs", headers=headers, params={"search": "Shop"}
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.get(
        "/api/superadmin/orgs", headers=headers, params={"search": "Nonexistent"}
    )
    assert resp.json()["total"] == 0


async def test_get_org_detail(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.get(f"/api/superadmin/orgs/{org_id}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Shop"
    assert data["user_count"] == 2  # regular_admin + installer
    assert data["work_order_count"] == 0


async def test_get_org_detail_not_found(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get(
        f"/api/superadmin/orgs/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


async def test_create_org(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    plan_id = seed_data["plan"].id
    resp = await client.post(
        "/api/superadmin/orgs",
        headers=headers,
        json={"name": "New Org", "plan_id": str(plan_id)},
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "New Org"


async def test_update_org(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.patch(
        f"/api/superadmin/orgs/{org_id}",
        headers=headers,
        json={"name": "Renamed Shop", "is_active": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Renamed Shop"
    assert data["is_active"] is False


async def test_update_org_not_found(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.patch(
        f"/api/superadmin/orgs/{uuid.uuid4()}",
        headers=headers,
        json={"name": "X"},
    )
    assert resp.status_code == 404


# ── User endpoints ───────────────────────────────────────────────────


async def test_list_users(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get("/api/superadmin/users", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3  # superadmin + regular_admin + installer


async def test_list_users_filter_by_org(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.get(
        "/api/superadmin/users",
        headers=headers,
        params={"organization_id": str(org_id)},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


async def test_list_users_filter_by_role(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get(
        "/api/superadmin/users",
        headers=headers,
        params={"role": "installer"},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_get_user_detail(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    user_id = seed_data["regular_admin"].id
    resp = await client.get(f"/api/superadmin/users/{user_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@shop.com"


async def test_get_user_not_found(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get(
        f"/api/superadmin/users/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


async def test_update_user(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    user_id = seed_data["installer"].id
    resp = await client.patch(
        f"/api/superadmin/users/{user_id}",
        headers=headers,
        json={"role": "project_manager", "is_active": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "project_manager"
    assert data["is_active"] is False


async def test_update_user_not_found(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.patch(
        f"/api/superadmin/users/{uuid.uuid4()}",
        headers=headers,
        json={"role": "admin"},
    )
    assert resp.status_code == 404


async def test_create_superadmin_user(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.post(
        "/api/superadmin/users",
        headers=headers,
        json={
            "email": "new-sa@wrapflow.io",
            "password": "secure123",
            "is_superadmin": True,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_superadmin"] is True
    assert data["organization_id"] is None


async def test_create_superadmin_user_duplicate_email(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.post(
        "/api/superadmin/users",
        headers=headers,
        json={
            "email": "sa@wrapflow.io",
            "password": "pass",
            "is_superadmin": True,
        },
    )
    assert resp.status_code == 409


# ── Metrics endpoint ─────────────────────────────────────────────────


async def test_get_metrics(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get("/api/superadmin/metrics", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_organizations"] == 1
    assert data["total_users"] == 3
    assert data["total_work_orders"] == 0
    assert isinstance(data["orgs_by_plan"], list)
    assert isinstance(data["recent_signups"], list)


# ── Audit logs endpoint ─────────────────────────────────────────────


async def test_list_audit_logs_empty(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.get("/api/superadmin/audit-logs", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


# ── Impersonation endpoints ─────────────────────────────────────────


async def test_start_impersonation(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.post(
        f"/api/superadmin/impersonate/{org_id}", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["impersonating"] is True
    assert data["organization_id"] == str(org_id)
    assert "access_token" in data


async def test_start_impersonation_nonexistent_org(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.post(
        f"/api/superadmin/impersonate/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


async def test_start_impersonation_inactive_org(client, seed_data, db_session):
    headers = make_token(seed_data["superadmin"])
    # Deactivate the org
    org = seed_data["org"]
    org.is_active = False
    await db_session.commit()

    resp = await client.post(
        f"/api/superadmin/impersonate/{org.id}", headers=headers
    )
    assert resp.status_code == 404


async def test_stop_impersonation(client, seed_data):
    headers = make_token(seed_data["superadmin"])
    resp = await client.post("/api/superadmin/stop-impersonation", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["impersonating"] is False
    assert "access_token" in data


async def test_impersonation_token_has_correct_claims(client, seed_data):
    from app.auth.jwt import decode_token

    headers = make_token(seed_data["superadmin"])
    org_id = seed_data["org"].id
    resp = await client.post(
        f"/api/superadmin/impersonate/{org_id}", headers=headers
    )
    assert resp.status_code == 200

    token = resp.json()["access_token"]
    payload = decode_token(token)
    assert payload["is_superadmin"] is True
    assert payload["impersonating"] is True
    assert payload["org"] == str(org_id)
    assert payload["real_user_id"] == str(seed_data["superadmin"].id)
    assert payload["role"] == "admin"
```

### Run & verify

```bash
cd backend && uv run ruff check app/routers/superadmin.py tests/test_routers/test_superadmin_routes.py && uv run ruff format app/routers/superadmin.py tests/test_routers/test_superadmin_routes.py
cd backend && uv run pytest tests/test_routers/test_superadmin_routes.py -v
```

### Commit

```bash
git add backend/app/routers/superadmin.py backend/tests/test_routers/test_superadmin_routes.py
git commit -m "$(cat <<'EOF'
feat(api): add /api/superadmin routes for org/user/metrics/impersonation

Endpoints: list/get/create/update orgs, list/get/create/update users,
platform metrics, cross-org audit logs, start/stop impersonation.
All routes guarded by require_superadmin dependency.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Register Router in main.py

**Goal:** Include the superadmin router in the FastAPI app.

### Modify `backend/app/main.py`

Add the import and include:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.admin import router as admin_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.auth import router as auth_router
from app.routers.kanban_stages import router as kanban_stages_router
from app.routers.notifications import router as notifications_router
from app.routers.superadmin import router as superadmin_router
from app.routers.users import router as users_router
from app.routers.vehicles import router as vehicles_router
from app.routers.vin import router as vin_router
from app.routers.work_orders import router as work_orders_router


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


app.include_router(admin_router)
app.include_router(audit_logs_router)
app.include_router(auth_router)
app.include_router(kanban_stages_router)
app.include_router(notifications_router)
app.include_router(superadmin_router)
app.include_router(users_router)
app.include_router(vehicles_router)
app.include_router(vin_router)
app.include_router(work_orders_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Run & verify

```bash
cd backend && uv run ruff check app/main.py && uv run ruff format app/main.py
cd backend && uv run python -c "from app.main import app; print(f'Routes: {len(app.routes)}')"
```

### Commit

```bash
git add backend/app/main.py
git commit -m "$(cat <<'EOF'
feat(app): register superadmin router in main.py

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Full Test Suite + Lint

**Goal:** Run the complete test suite and lint pass to confirm nothing is broken.

### Run lint

```bash
cd backend && uv run ruff check app/ tests/ && uv run ruff format --check app/ tests/
```

If lint errors occur, fix them with:

```bash
cd backend && uv run ruff format app/ tests/
```

### Run full test suite

```bash
cd backend && uv run pytest -v --tb=short
```

Expected output: all tests pass, including:

- `tests/test_auth/test_jwt.py` -- 3 tests (new)
- `tests/test_auth/test_permissions.py` -- 10 tests (3 new)
- `tests/test_cli/test_seed_superadmin.py` -- 3 tests (new)
- `tests/test_services/test_audit_log_service.py` -- 4 tests (new)
- `tests/test_services/test_superadmin_service.py` -- 16 tests (new)
- `tests/test_routers/test_superadmin_routes.py` -- 23 tests (new)
- All existing tests continue to pass

### Commit (only if lint fixes were needed)

```bash
git add -A
git commit -m "$(cat <<'EOF'
style: lint fixes for superadmin feature

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Files Summary

### New files

| File | Purpose |
|------|---------|
| `backend/app/cli/__init__.py` | CLI package init |
| `backend/app/cli/__main__.py` | CLI entry point |
| `backend/app/cli/seed_superadmin.py` | Seed superadmin command |
| `backend/app/schemas/superadmin.py` | Pydantic schemas for superadmin API |
| `backend/app/services/superadmin.py` | Superadmin business logic |
| `backend/app/routers/superadmin.py` | Superadmin API routes |
| `backend/tests/test_auth/test_jwt.py` | JWT claim tests |
| `backend/tests/test_cli/test_seed_superadmin.py` | CLI seed tests |
| `backend/tests/test_services/test_audit_log_service.py` | Audit log cross-org tests |
| `backend/tests/test_services/test_superadmin_service.py` | Superadmin service tests |
| `backend/tests/test_routers/test_superadmin_routes.py` | Superadmin route integration tests |

### Modified files

| File | Change |
|------|--------|
| `backend/app/auth/jwt.py` | Add `is_superadmin`, `impersonating`, `real_user_id`, `expire_minutes` params |
| `backend/app/auth/permissions.py` | Fix `require_org_member` superadmin bypass, add `require_superadmin` |
| `backend/app/services/auth.py` | Pass `is_superadmin` to `create_access_token` |
| `backend/app/models/audit_log.py` | Add 3 new `ActionType` enum values |
| `backend/app/services/audit_log.py` | Add `list_all_logs()` method |
| `backend/app/main.py` | Register `superadmin_router` |
| `backend/tests/test_auth/test_permissions.py` | Add 3 new permission tests |
