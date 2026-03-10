import uuid

import pytest
from fastapi import HTTPException

from app.auth.permissions import require_org_member, require_role
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


@pytest.fixture
async def plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    return plan


@pytest.fixture
async def org(db_session, plan):
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


def make_user(
    org_id: uuid.UUID | None = None,
    role: Role = Role.ADMIN,
    is_superadmin: bool = False,
) -> User:
    return User(
        id=uuid.uuid4(),
        organization_id=org_id,
        email=f"{uuid.uuid4().hex[:8]}@test.com",
        password_hash="hashed",
        role=role,
        is_superadmin=is_superadmin,
    )


async def test_require_role_allows_matching_role(org):
    checker = require_role(Role.ADMIN)
    user = make_user(org_id=org.id, role=Role.ADMIN)
    result = await checker(user=user)
    assert result.role == Role.ADMIN


async def test_require_role_allows_multiple_roles(org):
    checker = require_role(Role.ADMIN, Role.PROJECT_MANAGER)
    user = make_user(org_id=org.id, role=Role.PROJECT_MANAGER)
    result = await checker(user=user)
    assert result.role == Role.PROJECT_MANAGER


async def test_require_role_denies_wrong_role(org):
    checker = require_role(Role.ADMIN)
    user = make_user(org_id=org.id, role=Role.INSTALLER)
    with pytest.raises(HTTPException) as exc_info:
        await checker(user=user)
    assert exc_info.value.status_code == 403


async def test_require_role_allows_superadmin(org):
    checker = require_role(Role.ADMIN)
    user = make_user(org_id=org.id, role=Role.INSTALLER, is_superadmin=True)
    result = await checker(user=user)
    assert result.is_superadmin is True


async def test_require_org_member_allows_with_org(org):
    user = make_user(org_id=org.id)
    result = await require_org_member(user=user)
    assert result.organization_id == org.id


async def test_require_org_member_denies_without_org():
    user = make_user(org_id=None)
    with pytest.raises(HTTPException) as exc_info:
        await require_org_member(user=user)
    assert exc_info.value.status_code == 403
