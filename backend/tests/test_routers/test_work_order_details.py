async def _register_and_seed(client, db_session):
    """Register a user and seed kanban stages."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "TestPass123",
            "org_name": "My Shop",
        },
    )
    token = resp.json()["access_token"]
    await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )
    return token


async def test_create_work_order_with_wrap_details(client, db_session):
    token = await _register_and_seed(client, db_session)

    # First create a vehicle (needed for wrap_details FK)
    vehicle_resp = await client.post(
        "/api/vehicles",
        json={"vin": "1HGCM82633A004352", "year": 2022, "make": "Honda", "model": "Accord"},
        headers={"Authorization": f"Bearer {token}"},
    )
    vehicle_id = vehicle_resp.json()["id"]

    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "vehicle_ids": [vehicle_id],
            "wrap_details": {
                "wrap_coverage": "full",
                "roof_coverage": "full",
                "door_handles": "partial",
                "window_coverage": "perforated_vinyl",
                "bumper_coverage": "both",
                "misc_items": ["mirror_caps", "grill"],
                "special_wrap_instructions": "Careful around mirrors",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["wrap_details"] is not None
    assert data["wrap_details"]["wrap_coverage"] == "full"
    assert data["wrap_details"]["roof_coverage"] == "full"
    assert data["wrap_details"]["bumper_coverage"] == "both"
    assert "mirror_caps" in data["wrap_details"]["misc_items"]


async def test_create_work_order_with_production_details(client, db_session):
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "production_details": {
                "print_media_brand_type": "3M IJ180mc",
                "laminate_brand_type": "3M 8518 Gloss",
                "window_perf_details": {"type": "3M IJ8171"},
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["production_details"] is not None
    assert data["production_details"]["print_media_brand_type"] == "3M IJ180mc"
    assert data["production_details"]["laminate_brand_type"] == "3M 8518 Gloss"


async def test_create_work_order_with_install_details(client, db_session):
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "install_details": {
                "install_location": "in_shop",
                "install_difficulty": "standard",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["install_details"] is not None
    assert data["install_details"]["install_location"] == "in_shop"
    assert data["install_details"]["install_difficulty"] == "standard"


async def test_create_work_order_with_all_details(client, db_session):
    token = await _register_and_seed(client, db_session)

    # Create vehicle for wrap details
    vehicle_resp = await client.post(
        "/api/vehicles",
        json={"year": 2023, "make": "Ford", "model": "F-150"},
        headers={"Authorization": f"Bearer {token}"},
    )
    vehicle_id = vehicle_resp.json()["id"]

    resp = await client.post(
        "/api/work-orders",
        json={
            "job_type": "commercial",
            "job_value": 7500,
            "priority": "high",
            "date_in": "2026-03-10T10:00:00Z",
            "vehicle_ids": [vehicle_id],
            "wrap_details": {
                "wrap_coverage": "three_quarter",
                "roof_coverage": "no",
            },
            "design_details": {
                "proofing_data": {"versions": [{"name": "v1", "status": "draft"}]},
            },
            "production_details": {
                "print_media_brand_type": "Avery MPI 1105",
            },
            "install_details": {
                "install_location": "on_site",
                "install_difficulty": "complex",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["job_value"] == 7500
    assert data["wrap_details"]["wrap_coverage"] == "three_quarter"
    assert data["design_details"] is not None
    assert data["production_details"]["print_media_brand_type"] == "Avery MPI 1105"
    assert data["install_details"]["install_location"] == "on_site"


async def test_create_work_order_without_details_still_works(client, db_session):
    """Backward compatibility: creating without sub-details still works."""
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["wrap_details"] is None
    assert data["design_details"] is None
    assert data["production_details"] is None
    assert data["install_details"] is None


async def test_wrap_details_not_created_without_vehicle(client, db_session):
    """Wrap details should NOT be created when no vehicle is provided (FK constraint)."""
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "wrap_details": {
                "wrap_coverage": "full",
                "roof_coverage": "full",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    # wrap_details should be None since no vehicle was provided
    assert data["wrap_details"] is None
