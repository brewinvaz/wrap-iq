import uuid

from app.models.estimate_defaults import EstimateDefaults
from app.models.organization import Organization
from app.models.plan import Plan
from app.services.estimate_matching import find_matching_estimates


async def _seed_org(db_session):
    """Create a plan and organization, return org_id."""
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Match Shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org.id


async def test_match_specific_rule(db_session):
    org_id = await _seed_org(db_session)

    # Generic rule (low priority)
    generic = EstimateDefaults(
        organization_id=org_id,
        job_type="commercial",
        design_hours=2,
        production_hours=4,
        install_hours=3,
        priority=1,
        is_active=True,
    )
    # Specific rule (high priority) — matches commercial + van
    specific = EstimateDefaults(
        organization_id=org_id,
        job_type="commercial",
        vehicle_type="van",
        design_hours=5,
        production_hours=10,
        install_hours=8,
        priority=10,
        is_active=True,
    )
    db_session.add_all([generic, specific])
    await db_session.flush()

    match = await find_matching_estimates(
        db_session,
        org_id,
        job_type="commercial",
        vehicle_type="van",
    )
    assert match is not None
    assert match.id == specific.id
    assert match.priority == 10


async def test_no_match_returns_none(db_session):
    org_id = await _seed_org(db_session)

    # Rule only matches commercial
    rule = EstimateDefaults(
        organization_id=org_id,
        job_type="commercial",
        design_hours=2,
        priority=1,
        is_active=True,
    )
    db_session.add(rule)
    await db_session.flush()

    match = await find_matching_estimates(
        db_session,
        org_id,
        job_type="personal",
    )
    assert match is None


async def test_vehicle_count_range(db_session):
    org_id = await _seed_org(db_session)

    rule = EstimateDefaults(
        organization_id=org_id,
        vehicle_count_min=5,
        vehicle_count_max=20,
        design_hours=10,
        production_hours=20,
        install_hours=15,
        priority=5,
        is_active=True,
    )
    db_session.add(rule)
    await db_session.flush()

    # Within range — should match
    match = await find_matching_estimates(
        db_session,
        org_id,
        vehicle_count=10,
    )
    assert match is not None
    assert match.id == rule.id

    # Below range — no match
    match = await find_matching_estimates(
        db_session,
        org_id,
        vehicle_count=2,
    )
    assert match is None

    # Above range — no match
    match = await find_matching_estimates(
        db_session,
        org_id,
        vehicle_count=25,
    )
    assert match is None
