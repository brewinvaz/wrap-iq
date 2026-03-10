import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.models.client_invite import ClientInvite
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User
from app.models.work_order import JobType
from app.services.onboarding import OnboardingService


@pytest.fixture
async def plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    return plan


@pytest.fixture
async def org(db_session, plan):
    org = Organization(
        id=uuid.uuid4(), name="Test Shop", slug="test-shop", plan_id=plan.id
    )
    db_session.add(org)
    await db_session.flush()
    return org


@pytest.fixture
async def lead_stage(db_session, org):
    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Lead",
        system_status=SystemStatus.LEAD,
        position=0,
        is_default=True,
    )
    db_session.add(stage)
    await db_session.flush()
    return stage


@pytest.fixture
async def admin(db_session, org):
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def service(db_session):
    return OnboardingService(db_session)


async def test_create_invite(db_session, org, admin, service):
    invite = await service.create_invite(org.id, "client@example.com", admin.id)
    assert invite.email == "client@example.com"
    assert invite.token is not None
    assert invite.accepted_at is None
    assert invite.organization_id == org.id


async def test_list_invites(db_session, org, admin, service):
    await service.create_invite(org.id, "a@example.com", admin.id)
    await service.create_invite(org.id, "b@example.com", admin.id)

    invites, total = await service.list_invites(org.id)
    assert total == 2
    assert len(invites) == 2


async def test_validate_token_valid(db_session, org, admin, service):
    invite = await service.create_invite(org.id, "c@example.com", admin.id)
    result = await service.validate_token(invite.token)
    assert result is not None
    assert result.id == invite.id


async def test_validate_token_expired(db_session, org, admin):
    invite = ClientInvite(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="expired@example.com",
        token="expired-token",
        invited_by=admin.id,
        expires_at=datetime.now(UTC) - timedelta(hours=1),
    )
    db_session.add(invite)
    await db_session.flush()

    service = OnboardingService(db_session)
    result = await service.validate_token("expired-token")
    assert result is None


async def test_validate_token_already_used(db_session, org, admin):
    invite = ClientInvite(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="used@example.com",
        token="used-token",
        invited_by=admin.id,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        accepted_at=datetime.now(UTC),
    )
    db_session.add(invite)
    await db_session.flush()

    service = OnboardingService(db_session)
    result = await service.validate_token("used-token")
    assert result is None


async def test_submit_onboarding(db_session, org, admin, lead_stage, service):
    invite = await service.create_invite(org.id, "new-client@example.com", admin.id)

    result = await service.submit_onboarding(
        invite=invite,
        first_name="John",
        last_name="Smith",
        phone="555-9999",
        company_name="Smith Fleet",
        address="456 Oak Ave",
        vehicle_data={"year": 2024, "make": "Ford", "model": "Transit"},
        job_type=JobType.COMMERCIAL,
        project_description="Full wrap for fleet van",
        referral_source="Google",
        file_keys=[],
    )

    assert result["job_number"] == "WO-00001"
    assert result["work_order_id"] is not None
    assert result["user_id"] is not None
    assert invite.accepted_at is not None


async def test_submit_onboarding_existing_user(
    db_session, org, admin, lead_stage, service
):
    existing = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="existing@example.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(existing)
    await db_session.flush()

    invite = await service.create_invite(org.id, "existing@example.com", admin.id)

    result = await service.submit_onboarding(
        invite=invite,
        first_name="Existing",
        last_name="Client",
        phone=None,
        company_name=None,
        address=None,
        vehicle_data={"vin": "1HGBH41JXMN109186"},
        job_type=JobType.PERSONAL,
        project_description=None,
        referral_source=None,
        file_keys=[],
    )

    assert result["user_id"] == existing.id


async def test_submit_onboarding_no_lead_stage(db_session, org, admin, service):
    invite = await service.create_invite(org.id, "nolead@example.com", admin.id)

    with pytest.raises(ValueError, match="No LEAD stage"):
        await service.submit_onboarding(
            invite=invite,
            first_name="No",
            last_name="Lead",
            phone=None,
            company_name=None,
            address=None,
            vehicle_data={"year": 2024, "make": "Toyota", "model": "Camry"},
            job_type=JobType.PERSONAL,
            project_description=None,
            referral_source=None,
            file_keys=[],
        )


async def test_submit_onboarding_with_file_keys(
    db_session, org, admin, lead_stage, service
):
    invite = await service.create_invite(org.id, "files@example.com", admin.id)

    file_keys = [
        {
            "r2_key": f"{org.id}/onboarding/abc_ref.jpg",
            "filename": "ref.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 2048,
        }
    ]

    result = await service.submit_onboarding(
        invite=invite,
        first_name="File",
        last_name="Client",
        phone=None,
        company_name=None,
        address=None,
        vehicle_data={"year": 2023, "make": "Honda", "model": "Civic"},
        job_type=JobType.PERSONAL,
        project_description=None,
        referral_source=None,
        file_keys=file_keys,
    )

    assert result["work_order_id"] is not None
