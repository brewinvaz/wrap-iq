from sqlalchemy import select, update

from app.models.user import Role, User


async def _register_admin(client, db_session):
    """Register an admin user and return token."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "timelog-admin@shop.com",
            "password": "TestPass123",
            "org_name": "Time Shop",
        },
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def _register_client_user(client, db_session):
    """Register a second user with client role, return token."""
    # Register as a new user
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "timelog-client@shop.com",
            "password": "TestPass123",
            "org_name": "Client Shop",
        },
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    # Update role to CLIENT
    result = await db_session.execute(
        select(User).where(User.email == "timelog-client@shop.com")
    )
    user = result.scalar_one()
    await db_session.execute(
        update(User).where(User.id == user.id).values(role=Role.CLIENT)
    )
    await db_session.commit()

    return token


async def test_create_time_log_with_phase(client, db_session):
    token = await _register_admin(client, db_session)

    resp = await client.post(
        "/api/time-logs",
        json={
            "task": "Design mockup",
            "hours": "2.5",
            "log_date": "2026-03-13",
            "phase": "design",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["task"] == "Design mockup"
    assert data["hours"] == "2.50"
    assert data["phase"] == "design"
    assert data["status"] == "submitted"


async def test_create_time_log_without_phase(client, db_session):
    token = await _register_admin(client, db_session)

    resp = await client.post(
        "/api/time-logs",
        json={
            "task": "General admin",
            "hours": "1.0",
            "log_date": "2026-03-13",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["phase"] is None


async def test_client_role_cannot_create_time_log(client, db_session):
    token = await _register_client_user(client, db_session)

    resp = await client.post(
        "/api/time-logs",
        json={
            "task": "Should fail",
            "hours": "1.0",
            "log_date": "2026-03-13",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


async def test_update_own_submitted_time_log(client, db_session):
    token = await _register_admin(client, db_session)

    # Create a time log
    create_resp = await client.post(
        "/api/time-logs",
        json={
            "task": "Original task",
            "hours": "2.0",
            "log_date": "2026-03-13",
            "phase": "design",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    tl_id = create_resp.json()["id"]

    # Update it
    update_resp = await client.patch(
        f"/api/time-logs/{tl_id}",
        json={
            "task": "Updated task",
            "hours": "3.0",
            "phase": "production",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["task"] == "Updated task"
    assert data["hours"] == "3.00"
    assert data["phase"] == "production"


async def test_delete_own_submitted_time_log(client, db_session):
    token = await _register_admin(client, db_session)

    # Create a time log
    create_resp = await client.post(
        "/api/time-logs",
        json={
            "task": "To delete",
            "hours": "1.0",
            "log_date": "2026-03-13",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    tl_id = create_resp.json()["id"]

    # Delete it
    delete_resp = await client.delete(
        f"/api/time-logs/{tl_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get(
        "/api/time-logs",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0


async def test_cannot_update_approved_time_log(client, db_session):
    token = await _register_admin(client, db_session)

    # Create a time log
    create_resp = await client.post(
        "/api/time-logs",
        json={
            "task": "Approved task",
            "hours": "2.0",
            "log_date": "2026-03-13",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    tl_id = create_resp.json()["id"]

    # Approve it
    approve_resp = await client.patch(
        f"/api/time-logs/{tl_id}/approve",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert approve_resp.status_code == 200

    # Try to update - should fail
    update_resp = await client.patch(
        f"/api/time-logs/{tl_id}",
        json={"task": "Should fail"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_resp.status_code == 400
