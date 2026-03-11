async def _register_and_seed_stages(client, db_session):
    """Register a user, then seed kanban stages for their org."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "Testpass123",
            "org_name": "My Shop",
        },
    )
    token = resp.json()["access_token"]

    # Trigger kanban stage seeding by listing stages
    await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )

    return token


async def test_create_work_order(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={
            "job_type": "commercial",
            "job_value": 5000,
            "priority": "high",
            "date_in": "2026-03-10T10:00:00Z",
            "internal_notes": "Rush job",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["job_number"] == "WO-0001"
    assert data["job_type"] == "commercial"
    assert data["job_value"] == 5000
    assert data["priority"] == "high"
    assert data["status"] is not None
    assert data["status"]["name"] == "Lead"


async def test_list_work_orders(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    # Create two work orders
    await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-11T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/work-orders",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_get_work_order(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z", "internal_notes": "Test note"},
        headers={"Authorization": f"Bearer {token}"},
    )
    wo_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["internal_notes"] == "Test note"


async def test_update_work_order(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    wo_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/work-orders/{wo_id}",
        json={"job_value": 9999, "priority": "low"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["job_value"] == 9999
    assert resp.json()["priority"] == "low"


async def test_update_work_order_status(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    # Create a work order
    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    wo_id = create_resp.json()["id"]

    # Get stages to find an "IN_PROGRESS" stage
    stages_resp = await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )
    stages = stages_resp.json()
    in_progress_stage = next(
        s for s in stages if s.get("system_status") == "IN_PROGRESS"
    )

    resp = await client.patch(
        f"/api/work-orders/{wo_id}/status",
        json={"status_id": in_progress_stage["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"]["name"] == in_progress_stage["name"]
