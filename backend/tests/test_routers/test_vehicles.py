async def _register_user(client, email="admin@shop.com"):
    resp = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "Testpass123", "org_name": "My Shop"},
    )
    return resp.json()["access_token"]


async def test_create_vehicle(client):
    token = await _register_user(client)
    resp = await client.post(
        "/api/vehicles",
        json={
            "make": "Ford",
            "model": "Transit",
            "year": 2024,
            "vehicle_type": "van",
            "van_roof_height": "high",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["make"] == "Ford"
    assert data["model"] == "Transit"
    assert data["year"] == 2024
    assert data["vehicle_type"] == "van"
    assert data["van_roof_height"] == "high"


async def test_list_vehicles(client):
    token = await _register_user(client)

    # Create two vehicles
    await client.post(
        "/api/vehicles",
        json={"make": "Ford", "model": "Transit"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/vehicles",
        json={"make": "Chevy", "model": "Express"},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/vehicles",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_get_vehicle(client):
    token = await _register_user(client)

    create_resp = await client.post(
        "/api/vehicles",
        json={"make": "Toyota", "model": "Tacoma", "year": 2023},
        headers={"Authorization": f"Bearer {token}"},
    )
    vehicle_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/vehicles/{vehicle_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["make"] == "Toyota"


async def test_update_vehicle(client):
    token = await _register_user(client)

    create_resp = await client.post(
        "/api/vehicles",
        json={"make": "Ford", "model": "F-150"},
        headers={"Authorization": f"Bearer {token}"},
    )
    vehicle_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/vehicles/{vehicle_id}",
        json={"year": 2025, "truck_cab_size": "crew"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["year"] == 2025
    assert resp.json()["truck_cab_size"] == "crew"
