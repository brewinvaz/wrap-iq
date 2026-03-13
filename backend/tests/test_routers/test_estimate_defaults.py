async def _register_admin(client, db_session):
    """Register an admin user and return token."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "defaults-admin@shop.com",
            "password": "TestPass123",
            "org_name": "Defaults Shop",
        },
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def test_create_estimate_default(client, db_session):
    token = await _register_admin(client, db_session)

    resp = await client.post(
        "/api/estimate-defaults",
        json={
            "job_type": "commercial",
            "vehicle_type": "van",
            "wrap_coverage": "full",
            "design_hours": "4.0",
            "production_hours": "8.0",
            "install_hours": "6.0",
            "priority": 10,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["job_type"] == "commercial"
    assert data["vehicle_type"] == "van"
    assert data["wrap_coverage"] == "full"
    assert data["design_hours"] == "4.00"
    assert data["production_hours"] == "8.00"
    assert data["install_hours"] == "6.00"
    assert data["priority"] == 10
    assert data["is_active"] is True


async def test_list_estimate_defaults(client, db_session):
    token = await _register_admin(client, db_session)

    # Create two rules with different priorities
    await client.post(
        "/api/estimate-defaults",
        json={"job_type": "commercial", "priority": 5, "design_hours": "2.0"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/estimate-defaults",
        json={"job_type": "personal", "priority": 15, "design_hours": "1.0"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/estimate-defaults",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    # Should be ordered by priority desc (15 first, then 5)
    assert data["items"][0]["priority"] == 15
    assert data["items"][1]["priority"] == 5


async def test_update_estimate_default(client, db_session):
    token = await _register_admin(client, db_session)

    # Create a rule
    create_resp = await client.post(
        "/api/estimate-defaults",
        json={"job_type": "commercial", "design_hours": "4.0", "priority": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    rule_id = create_resp.json()["id"]

    # Update it
    update_resp = await client.patch(
        f"/api/estimate-defaults/{rule_id}",
        json={"design_hours": "6.0", "priority": 20},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["design_hours"] == "6.00"
    assert data["priority"] == 20


async def test_delete_estimate_default(client, db_session):
    token = await _register_admin(client, db_session)

    # Create a rule
    create_resp = await client.post(
        "/api/estimate-defaults",
        json={"job_type": "commercial", "design_hours": "4.0"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    rule_id = create_resp.json()["id"]

    # Delete it
    delete_resp = await client.delete(
        f"/api/estimate-defaults/{rule_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get(
        "/api/estimate-defaults",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0
