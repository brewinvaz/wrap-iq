async def _register_and_seed_stages(client, db_session):
    """Register a user, then seed kanban stages for their org."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "TestPass123",
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

    # Get stages to find an "in_progress" stage
    stages_resp = await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )
    stages = stages_resp.json()
    in_progress_stage = next(
        s for s in stages if s.get("system_status") == "in_progress"
    )

    resp = await client.patch(
        f"/api/work-orders/{wo_id}/status",
        json={"status_id": in_progress_stage["id"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"]["name"] == in_progress_stage["name"]


async def test_delete_work_order(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    # Create a work order
    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    wo_id = create_resp.json()["id"]

    # Delete it
    resp = await client.delete(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 404


async def test_delete_work_order_not_found(client, db_session):
    token = await _register_and_seed_stages(client, db_session)

    import uuid
    resp = await client.delete(
        f"/api/work-orders/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_delete_work_order_with_invoice_blocked(client, db_session):
    """Work orders with linked invoices cannot be deleted."""
    from app.models.invoice import Invoice

    token = await _register_and_seed_stages(client, db_session)

    # Create a work order
    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    wo_data = create_resp.json()
    wo_id = wo_data["id"]

    # Manually insert an invoice linked to this work order
    from sqlalchemy import select

    from app.models.user import User

    user_result = await db_session.execute(select(User).limit(1))
    user = user_result.scalar_one()

    invoice = Invoice(
        organization_id=user.organization_id,
        work_order_id=wo_id,
        invoice_number="INV-0001",
        client_email="test@example.com",
        client_name="Test Client",
    )
    db_session.add(invoice)
    await db_session.commit()

    # Attempt delete — should be blocked
    resp = await client.delete(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409
    assert "invoices" in resp.json()["detail"].lower()

    # Verify work order still exists
    get_resp = await client.get(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_resp.status_code == 200


async def test_delete_work_order_tenant_isolation(client, db_session):
    """Cannot delete a work order belonging to another organization."""
    token_a = await _register_and_seed_stages(client, db_session)

    # Register a second user/org
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "other@shop.com",
            "password": "TestPass123",
            "org_name": "Other Shop",
        },
    )
    token_b = resp.json()["access_token"]

    # Create a work order in org A
    create_resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    wo_id = create_resp.json()["id"]

    # Attempt delete from org B — should be 404
    resp = await client.delete(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 404

    # Verify work order still exists in org A
    get_resp = await client.get(
        f"/api/work-orders/{wo_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert get_resp.status_code == 200
