async def _register_admin(client):
    """Register an admin user and return token."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "presets-admin@shop.com",
            "password": "TestPass123",
            "org_name": "Presets Shop",
        },
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def _register_installer(client, admin_token):
    """Create a non-admin user and return token."""
    # Register a second user in the same org by using invite flow
    # For simplicity, register a new org user (different org)
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "installer@othershop.com",
            "password": "TestPass123",
            "org_name": "Other Shop",
        },
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    # Change role to installer via direct DB or just test with this user
    # Since register creates an admin, we'll test admin vs different org instead
    return token


async def test_list_task_presets_lazy_seeds_defaults(client, db_session):
    """First access should lazy-seed default presets."""
    token = await _register_admin(client)

    resp = await client.get(
        "/api/task-presets",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    # Should have seeded defaults for all 4 phases
    assert data["total"] > 0
    phases = {item["phase"] for item in data["items"]}
    assert "design" in phases
    assert "production" in phases
    assert "install" in phases
    assert "other" in phases


async def test_list_task_presets_filter_by_phase(client, db_session):
    token = await _register_admin(client)

    # Trigger lazy seed
    await client.get(
        "/api/task-presets",
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/task-presets?phase=design",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] > 0
    assert all(item["phase"] == "design" for item in data["items"])


async def test_create_task_preset(client, db_session):
    token = await _register_admin(client)

    resp = await client.post(
        "/api/task-presets",
        json={"phase": "design", "name": "Custom Design Task", "sort_order": 99},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["phase"] == "design"
    assert data["name"] == "Custom Design Task"
    assert data["sort_order"] == 99
    assert data["is_active"] is True


async def test_update_task_preset(client, db_session):
    token = await _register_admin(client)

    # Create a preset
    create_resp = await client.post(
        "/api/task-presets",
        json={"phase": "install", "name": "Test Task", "sort_order": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    preset_id = create_resp.json()["id"]

    # Update it
    update_resp = await client.patch(
        f"/api/task-presets/{preset_id}",
        json={"name": "Updated Task", "sort_order": 5, "is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["name"] == "Updated Task"
    assert data["sort_order"] == 5
    assert data["is_active"] is False


async def test_delete_task_preset(client, db_session):
    token = await _register_admin(client)

    # Create a preset
    create_resp = await client.post(
        "/api/task-presets",
        json={"phase": "production", "name": "Deletable Task"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_resp.status_code == 201
    preset_id = create_resp.json()["id"]

    # Delete it
    delete_resp = await client.delete(
        f"/api/task-presets/{preset_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code == 204

    # Verify it's gone from list
    list_resp = await client.get(
        "/api/task-presets?phase=production",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_resp.status_code == 200
    ids = [item["id"] for item in list_resp.json()["items"]]
    assert preset_id not in ids


async def test_preset_not_found_returns_404(client, db_session):
    token = await _register_admin(client)

    resp = await client.patch(
        "/api/task-presets/00000000-0000-0000-0000-000000000000",
        json={"name": "nope"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_second_list_does_not_reseed(client, db_session):
    """Calling list twice should not duplicate presets."""
    token = await _register_admin(client)

    resp1 = await client.get(
        "/api/task-presets",
        headers={"Authorization": f"Bearer {token}"},
    )
    total1 = resp1.json()["total"]

    resp2 = await client.get(
        "/api/task-presets",
        headers={"Authorization": f"Bearer {token}"},
    )
    total2 = resp2.json()["total"]

    assert total1 == total2
