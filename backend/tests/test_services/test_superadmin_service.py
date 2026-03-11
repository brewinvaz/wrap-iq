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
        password_hash=hash_password("Testpass123"),
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
        password="Testpass123",
        superadmin_id=superadmin.id,
    )
    assert user.is_superadmin is True
    assert user.organization_id is None


async def test_create_superadmin_user_duplicate_email(db_session, superadmin, service):
    with pytest.raises(ValueError, match="Email already registered"):
        await service.create_superadmin_user(
            email="sa@test.com",
            password="Testpass123",
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
