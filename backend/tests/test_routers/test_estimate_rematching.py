"""Tests for estimate re-matching on work order PATCH."""

from decimal import Decimal

from sqlalchemy import select

from app.models.estimate_defaults import EstimateDefaults
from app.models.user import User


async def _setup(client, db_session):
    """Register user, seed kanban stages, and create estimate rules."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "estimator@shop.com",
            "password": "TestPass123",
            "org_name": "Estimate Shop",
        },
    )
    token = resp.json()["access_token"]

    # Trigger kanban stage seeding
    await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )

    # Get the org_id
    user_result = await db_session.execute(
        select(User).where(User.email == "estimator@shop.com")
    )
    user = user_result.scalar_one()

    # Create estimate rules
    commercial = EstimateDefaults(
        organization_id=user.organization_id,
        job_type="commercial",
        design_hours=Decimal("5"),
        production_hours=Decimal("10"),
        install_hours=Decimal("8"),
        priority=1,
        is_active=True,
    )
    personal = EstimateDefaults(
        organization_id=user.organization_id,
        job_type="personal",
        design_hours=Decimal("2"),
        production_hours=Decimal("4"),
        install_hours=Decimal("3"),
        priority=1,
        is_active=True,
    )
    db_session.add_all([commercial, personal])
    await db_session.commit()

    return token


async def test_patch_job_type_triggers_rematching(client, db_session):
    """Changing job_type on PATCH should re-run estimate matching."""
    token = await _setup(client, db_session)

    # Create a personal work order
    create_resp = await client.post(
        "/api/work-orders",
        json={"job_type": "personal", "date_in": "2026-01-15T09:00:00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    wo_id = create_resp.json()["id"]
    # personal rule: 2 + 4 + 3 = 9
    assert Decimal(str(create_resp.json()["estimated_hours"])) == Decimal("9")

    # PATCH to commercial
    patch_resp = await client.patch(
        f"/api/work-orders/{wo_id}",
        json={"job_type": "commercial"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200
    # commercial rule: 5 + 10 + 8 = 23
    assert Decimal(str(patch_resp.json()["estimated_hours"])) == Decimal("23")


async def test_manual_override_on_patch(client, db_session):
    """Explicitly setting estimated_hours on PATCH should override auto-matching."""
    token = await _setup(client, db_session)

    create_resp = await client.post(
        "/api/work-orders",
        json={"job_type": "personal", "date_in": "2026-01-15T09:00:00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    wo_id = create_resp.json()["id"]

    # Manual override
    patch_resp = await client.patch(
        f"/api/work-orders/{wo_id}",
        json={"estimated_hours": "42.5"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200
    assert Decimal(str(patch_resp.json()["estimated_hours"])) == Decimal("42.5")


async def test_irrelevant_patch_no_rematching(client, db_session):
    """Patching non-estimate fields should not change estimated_hours."""
    token = await _setup(client, db_session)

    create_resp = await client.post(
        "/api/work-orders",
        json={"job_type": "personal", "date_in": "2026-01-15T09:00:00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    wo_id = create_resp.json()["id"]
    original_hours = create_resp.json()["estimated_hours"]

    # PATCH an irrelevant field
    patch_resp = await client.patch(
        f"/api/work-orders/{wo_id}",
        json={"internal_notes": "test note"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["estimated_hours"] == original_hours


async def test_manual_override_null(client, db_session):
    """Setting estimated_hours to null should clear it."""
    token = await _setup(client, db_session)

    create_resp = await client.post(
        "/api/work-orders",
        json={"job_type": "personal", "date_in": "2026-01-15T09:00:00"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    wo_id = create_resp.json()["id"]
    assert create_resp.json()["estimated_hours"] is not None

    # Set to null
    patch_resp = await client.patch(
        f"/api/work-orders/{wo_id}",
        json={"estimated_hours": None},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["estimated_hours"] is None
