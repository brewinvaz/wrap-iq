async def _register(client):
    """Register a user and return their access token."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "TestPass123",
            "org_name": "My Shop",
        },
    )
    return resp.json()["access_token"]


async def test_create_estimate(client, db_session):
    token = await _register(client)

    resp = await client.post(
        "/api/estimates",
        json={
            "client_name": "John Doe",
            "client_email": "john@example.com",
            "tax_rate": "8",
            "notes": "Rush job",
            "line_items": [
                {"description": "Full wrap", "unit_price": 250000},
                {"description": "Design fee", "unit_price": 50000},
            ],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["estimate_number"] == "EST-1001"
    assert data["client_name"] == "John Doe"
    assert data["status"] == "draft"
    assert data["subtotal"] == 300000
    assert data["total"] == 324000
    assert len(data["line_items"]) == 2


async def test_list_estimates(client, db_session):
    token = await _register(client)

    await client.post(
        "/api/estimates",
        json={
            "client_name": "A",
            "client_email": "a@x.com",
            "line_items": [{"description": "Item", "unit_price": 1000}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/estimates",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1


async def test_get_estimate(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/estimates",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "line_items": [{"description": "Item", "unit_price": 5000}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    estimate_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/estimates/{estimate_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["client_name"] == "John"


async def test_update_estimate(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/estimates",
        json={
            "client_name": "Old",
            "client_email": "old@x.com",
            "line_items": [{"description": "Item", "unit_price": 1000}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    estimate_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/estimates/{estimate_id}",
        json={"client_name": "New", "notes": "Updated"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["client_name"] == "New"
    assert resp.json()["notes"] == "Updated"


async def test_add_line_item(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/estimates",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "line_items": [{"description": "Item 1", "unit_price": 10000}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    estimate_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/estimates/{estimate_id}/line-items",
        json={"description": "Item 2", "unit_price": 5000},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["description"] == "Item 2"


async def test_remove_line_item(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/estimates",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "line_items": [
                {"description": "Item 1", "unit_price": 10000},
                {"description": "Item 2", "unit_price": 5000},
            ],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    estimate_id = create_resp.json()["id"]
    line_item_id = create_resp.json()["line_items"][0]["id"]

    resp = await client.delete(
        f"/api/estimates/{estimate_id}/line-items/{line_item_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204


async def test_send_estimate(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/estimates",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "line_items": [{"description": "Item", "unit_price": 1000}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    estimate_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/estimates/{estimate_id}/send",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "sent"
    assert resp.json()["sent_at"] is not None


async def test_get_estimate_not_found(client, db_session):
    token = await _register(client)
    import uuid

    resp = await client.get(
        f"/api/estimates/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_estimate_requires_auth(client, db_session):
    resp = await client.get("/api/estimates")
    assert resp.status_code == 401
