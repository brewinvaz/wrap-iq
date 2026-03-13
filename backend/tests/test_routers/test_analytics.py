from sqlalchemy import select, update

from app.models.user import Role, User


async def _register_admin(client, db_session):
    """Register an admin user and return token."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "analytics-admin@shop.com",
            "password": "TestPass123",
            "org_name": "Analytics Shop",
        },
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def _register_installer(client, db_session):
    """Register a second user with installer role, return token."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "analytics-installer@shop.com",
            "password": "TestPass123",
            "org_name": "Installer Shop",
        },
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    result = await db_session.execute(
        select(User).where(User.email == "analytics-installer@shop.com")
    )
    user = result.scalar_one()
    await db_session.execute(
        update(User).where(User.id == user.id).values(role=Role.INSTALLER)
    )
    await db_session.commit()

    return token


async def test_analytics_summary_empty(client, db_session):
    token = await _register_admin(client, db_session)

    resp = await client.get(
        "/api/analytics/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_hours"] == "0"
    assert data["avg_effective_rate"] is None
    assert data["avg_efficiency_pct"] is None
    assert data["total_jobs_completed"] == 0


async def test_analytics_summary_forbidden_for_installer(client, db_session):
    token = await _register_installer(client, db_session)

    resp = await client.get(
        "/api/analytics/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_analytics_hours_by_member(client, db_session):
    token = await _register_admin(client, db_session)

    # Log some time
    resp = await client.post(
        "/api/time-logs",
        json={
            "task": "Design work",
            "hours": "3.5",
            "log_date": "2026-03-13",
            "phase": "design",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201

    resp = await client.post(
        "/api/time-logs",
        json={
            "task": "Install work",
            "hours": "2.0",
            "log_date": "2026-03-13",
            "phase": "install",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201

    # Check hours by member
    resp = await client.get(
        "/api/analytics/hours-by-member",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    member = data["items"][0]
    assert member["email"] == "analytics-admin@shop.com"
    assert member["total_hours"] == "5.50"
    assert "design" in member["phase_breakdown"]
    assert member["phase_breakdown"]["design"] == "3.50"
    assert member["phase_breakdown"]["install"] == "2.00"


async def test_analytics_efficiency_empty(client, db_session):
    token = await _register_admin(client, db_session)

    resp = await client.get(
        "/api/analytics/efficiency",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []


async def test_analytics_roi_trend_empty(client, db_session):
    token = await _register_admin(client, db_session)

    resp = await client.get(
        "/api/analytics/roi-trend",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []


async def test_analytics_jobs_ranked_empty(client, db_session):
    token = await _register_admin(client, db_session)

    resp = await client.get(
        "/api/analytics/jobs-ranked",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
