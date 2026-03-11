async def _register_and_seed_stages(
    client, db_session, email="admin@shop.com", org_name="My Shop"
):
    """Register a user, then seed kanban stages for their org."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Testpass123",
            "org_name": org_name,
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


async def test_create_wo_cross_tenant_vehicle_blocked(client, db_session):
    """Creating a work order with a vehicle from another org should return 403."""
    # Register org A
    token_a = await _register_and_seed_stages(
        client, db_session, "user_a@shop.com", "Org A"
    )

    # Register org B and create a vehicle in org B
    token_b = await _register_and_seed_stages(
        client, db_session, "user_b@other.com", "Org B"
    )
    vehicle_resp = await client.post(
        "/api/vehicles",
        json={"make": "Toyota", "model": "Camry", "year": 2024},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert vehicle_resp.status_code == 201
    other_vehicle_id = vehicle_resp.json()["id"]

    # Org A tries to create a work order with org B's vehicle
    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "vehicle_ids": [other_vehicle_id],
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 403
    assert "not found in your organization" in resp.json()["detail"]


async def test_create_wo_cross_tenant_client_blocked(client, db_session):
    """Creating a work order with a client from another org should return 403."""
    # Register org A
    token_a = await _register_and_seed_stages(
        client, db_session, "user_a@shop.com", "Org A"
    )

    # Register org B and create a client in org B
    token_b = await _register_and_seed_stages(
        client, db_session, "user_b@other.com", "Org B"
    )
    client_resp = await client.post(
        "/api/clients",
        json={"name": "External Client"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert client_resp.status_code == 201
    other_client_id = client_resp.json()["id"]

    # Org A tries to create a work order with org B's client
    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "client_id": other_client_id,
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 403
    assert "not found in your organization" in resp.json()["detail"]


async def test_update_wo_cross_tenant_client_blocked(client, db_session):
    """Updating a work order with a client from another org should return 403."""
    # Register org A and create a work order
    token_a = await _register_and_seed_stages(
        client, db_session, "user_a@shop.com", "Org A"
    )
    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_resp.status_code == 201
    wo_id = create_resp.json()["id"]

    # Register org B and create a client in org B
    token_b = await _register_and_seed_stages(
        client, db_session, "user_b@other.com", "Org B"
    )
    client_resp = await client.post(
        "/api/clients",
        json={"name": "External Client"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert client_resp.status_code == 201
    other_client_id = client_resp.json()["id"]

    # Org A tries to update work order with org B's client
    resp = await client.patch(
        f"/api/work-orders/{wo_id}",
        json={"client_id": other_client_id},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 403
    assert "not found in your organization" in resp.json()["detail"]


async def test_create_work_order_with_own_vehicle_succeeds(client, db_session):
    """Creating a work order with own org's vehicle should succeed."""
    token = await _register_and_seed_stages(client, db_session)

    # Create a vehicle in the same org
    vehicle_resp = await client.post(
        "/api/vehicles",
        json={"make": "Honda", "model": "Civic", "year": 2024},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert vehicle_resp.status_code == 201
    vehicle_id = vehicle_resp.json()["id"]

    # Create work order with own vehicle
    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "vehicle_ids": [vehicle_id],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert len(resp.json()["vehicles"]) == 1


async def test_create_wo_nonexistent_vehicle_blocked(client, db_session):
    """Creating a work order with a nonexistent vehicle ID should return 403."""
    token = await _register_and_seed_stages(client, db_session)
    import uuid

    fake_id = str(uuid.uuid4())
    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "vehicle_ids": [fake_id],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
