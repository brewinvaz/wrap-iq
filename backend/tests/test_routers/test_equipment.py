import pytest


async def _register_and_get_token(client):
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "TestPass123!",
            "org_name": "My Shop",
        },
    )
    return resp.json()["access_token"]


async def test_create_equipment(client, db_session):
    token = await _register_and_get_token(client)
    resp = await client.post(
        "/api/equipment",
        json={
            "name": "Roland VG3-640",
            "serial_number": "SN-001",
            "equipment_type": "printer",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Roland VG3-640"
    assert data["equipment_type"] == "printer"
    assert data["is_active"] is True


async def test_list_equipment(client, db_session):
    token = await _register_and_get_token(client)
    await client.post(
        "/api/equipment",
        json={"name": "Printer A", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/equipment",
        json={"name": "Laminator B", "equipment_type": "laminator"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/equipment",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_list_filter_by_type(client, db_session):
    token = await _register_and_get_token(client)
    await client.post(
        "/api/equipment",
        json={"name": "Printer A", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/equipment",
        json={"name": "Laminator B", "equipment_type": "laminator"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/equipment?equipment_type=printer",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_list_filter_by_active(client, db_session):
    token = await _register_and_get_token(client)
    await client.post(
        "/api/equipment",
        json={"name": "Active", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/equipment",
        json={"name": "Inactive", "equipment_type": "printer", "is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/equipment?is_active=true",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_get_equipment(client, db_session):
    token = await _register_and_get_token(client)
    create_resp = await client.post(
        "/api/equipment",
        json={"name": "Test", "equipment_type": "plotter"},
        headers={"Authorization": f"Bearer {token}"},
    )
    eq_id = create_resp.json()["id"]
    resp = await client.get(
        f"/api/equipment/{eq_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test"


async def test_update_equipment(client, db_session):
    token = await _register_and_get_token(client)
    create_resp = await client.post(
        "/api/equipment",
        json={"name": "Old", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    eq_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/equipment/{eq_id}",
        json={"name": "New"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"


async def test_delete_equipment(client, db_session):
    token = await _register_and_get_token(client)
    create_resp = await client.post(
        "/api/equipment",
        json={"name": "Delete Me", "equipment_type": "other"},
        headers={"Authorization": f"Bearer {token}"},
    )
    eq_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/equipment/{eq_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204


async def test_delete_equipment_in_use_returns_409(client, db_session):
    token = await _register_and_get_token(client)
    eq_resp = await client.post(
        "/api/equipment",
        json={"name": "In-Use Printer", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    eq_id = eq_resp.json()["id"]

    # Seed kanban stages (required for work order creation)
    await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )

    wo_resp = await client.post(
        "/api/work-orders",
        json={
            "job_type": "personal",
            "date_in": "2026-03-13T00:00:00Z",
            "production_details": {"printer_id": eq_id},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert wo_resp.status_code == 201, f"Work order creation failed: {wo_resp.json()}"

    resp = await client.delete(
        f"/api/equipment/{eq_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


async def test_get_stats(client, db_session):
    token = await _register_and_get_token(client)
    await client.post(
        "/api/equipment",
        json={"name": "P1", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/equipment",
        json={"name": "O1", "equipment_type": "other"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/equipment/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["active"] == 2
    assert data["printers"] == 1
    assert data["other"] == 1


async def test_unauthorized_returns_401(client, db_session):
    resp = await client.get("/api/equipment")
    assert resp.status_code == 401
