async def _register_and_get_token(client):
    """Register a user and return auth token."""
    resp = await client.post(
        "/api/auth/register",
        json={"email": "admin@shop.com", "password": "testpass123", "org_name": "My Shop"},
    )
    return resp.json()["access_token"]


async def test_create_client_endpoint(client, db_session):
    token = await _register_and_get_token(client)

    resp = await client.post(
        "/api/clients",
        json={
            "name": "John Doe",
            "client_type": "personal",
            "email": "john@example.com",
            "phone": "555-1234",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "John Doe"
    assert data["client_type"] == "personal"
    assert data["email"] == "john@example.com"
    assert data["is_active"] is True
    assert data["parent_id"] is None


async def test_list_clients_endpoint(client, db_session):
    token = await _register_and_get_token(client)

    await client.post(
        "/api/clients",
        json={"name": "Client A"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/clients",
        json={"name": "Client B"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/clients",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_get_client_detail_endpoint(client, db_session):
    token = await _register_and_get_token(client)

    create_resp = await client.post(
        "/api/clients",
        json={"name": "Detail Client", "client_type": "business"},
        headers={"Authorization": f"Bearer {token}"},
    )
    client_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/clients/{client_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Detail Client"
    assert data["sub_clients"] == []
    assert data["project_count"] == 0
    assert data["total_revenue"] == 0


async def test_create_sub_client_endpoint(client, db_session):
    token = await _register_and_get_token(client)

    # Create parent business client
    parent_resp = await client.post(
        "/api/clients",
        json={"name": "Parent Corp", "client_type": "business"},
        headers={"Authorization": f"Bearer {token}"},
    )
    parent_id = parent_resp.json()["id"]

    # Create sub-client
    resp = await client.post(
        f"/api/clients/{parent_id}/sub-clients",
        json={"name": "Sub Location"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Sub Location"
    assert data["parent_id"] == parent_id


async def test_get_aggregate_report_endpoint(client, db_session):
    token = await _register_and_get_token(client)

    # Create parent business client
    parent_resp = await client.post(
        "/api/clients",
        json={"name": "Fleet Co", "client_type": "business"},
        headers={"Authorization": f"Bearer {token}"},
    )
    parent_id = parent_resp.json()["id"]

    resp = await client.get(
        f"/api/clients/{parent_id}/report",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["client_name"] == "Fleet Co"
    assert data["total_projects"] == 0
    assert data["combined_projects"] == 0
    assert data["sub_client_count"] == 0


async def test_unauthorized_returns_401(client, db_session):
    resp = await client.get("/api/clients")
    assert resp.status_code == 401
