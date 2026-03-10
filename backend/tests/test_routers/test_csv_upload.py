import io

from app.models.user import Role


def _make_csv_bytes(headers: str, *rows: str) -> bytes:
    lines = [headers, *rows]
    return "\n".join(lines).encode("utf-8")


async def _register_user(client, db_session, role: Role = Role.ADMIN):
    """Register a user and seed kanban stages, return token."""
    resp = await client.post(
        "/api/auth/register",
        json={"email": "admin@shop.com", "password": "testpass123", "org_name": "My Shop"},
    )
    token = resp.json()["access_token"]

    # Seed kanban stages
    await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )

    # If we need a non-admin role, update the user directly
    if role != Role.ADMIN:
        from sqlalchemy import select, update

        from app.models.user import User

        result = await db_session.execute(
            select(User).where(User.email == "admin@shop.com")
        )
        user = result.scalar_one()
        await db_session.execute(
            update(User).where(User.id == user.id).values(role=role)
        )
        await db_session.commit()

    return token


async def _register_non_admin(client, db_session, role: Role = Role.INSTALLER):
    """Register a user with a non-admin/PM role."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "installer@shop.com",
            "password": "testpass123",
            "org_name": "Installer Shop",
        },
    )
    token = resp.json()["access_token"]

    from sqlalchemy import select, update

    from app.models.user import User

    result = await db_session.execute(
        select(User).where(User.email == "installer@shop.com")
    )
    user = result.scalar_one()
    await db_session.execute(update(User).where(User.id == user.id).values(role=role))
    await db_session.commit()

    return token


async def test_upload_creates_work_orders(client, db_session):
    token = await _register_user(client, db_session)

    csv_content = _make_csv_bytes(
        "client_name,client_email,year,make,model,job_type,job_value,priority,notes",
        "Acme Corp,acme@test.com,2023,Honda,Accord,Commercial,1500.00,High,Full wrap",
        "Bob Shop,bob@test.com,2024,Ford,Transit,Personal,2000.00,Low,Partial",
    )

    resp = await client.post(
        "/api/csv-upload/upload",
        files={"file": ("orders.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 2
    assert data["successful"] == 2
    assert data["failed"] == 0
    assert len(data["created_ids"]) == 2
    assert data["errors"] == []


async def test_upload_with_validation_errors_returns_partial(client, db_session):
    token = await _register_user(client, db_session)

    csv_content = _make_csv_bytes(
        "client_name,job_type",
        "Acme Corp,Commercial",
        ",Commercial",  # missing client_name
        "Good Corp,Personal",
    )

    resp = await client.post(
        "/api/csv-upload/upload",
        files={"file": ("orders.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 3
    assert data["successful"] == 2
    assert data["failed"] == 1
    assert len(data["errors"]) >= 1


async def test_preview_returns_parsed_data(client, db_session):
    token = await _register_user(client, db_session)

    csv_content = _make_csv_bytes(
        "client_name,year,make,model",
        "Acme Corp,2023,Honda,Accord",
        "Bob Shop,2024,Ford,Transit",
    )

    resp = await client.post(
        "/api/csv-upload/preview",
        files={"file": ("orders.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 2
    assert "client_name" in data["headers"]
    assert len(data["sample_rows"]) == 2
    assert data["validation_errors"] == []


async def test_preview_with_validation_errors(client, db_session):
    token = await _register_user(client, db_session)

    csv_content = _make_csv_bytes(
        "client_name,job_type",
        "Acme Corp,Commercial",
        ",InvalidType",  # missing client_name + invalid job_type
    )

    resp = await client.post(
        "/api/csv-upload/preview",
        files={"file": ("orders.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["validation_errors"]) >= 1


async def test_template_returns_csv(client, db_session):
    token = await _register_user(client, db_session)

    resp = await client.get(
        "/api/csv-upload/template",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    content = resp.text
    assert "client_name" in content
    assert "vin" in content
    # Should have header + 2 example rows
    lines = [ln for ln in content.strip().split("\n") if ln.strip()]
    assert len(lines) == 3


async def test_non_admin_gets_403(client, db_session):
    token = await _register_non_admin(client, db_session)

    csv_content = _make_csv_bytes("client_name", "Acme Corp")

    resp = await client.post(
        "/api/csv-upload/upload",
        files={"file": ("orders.csv", io.BytesIO(csv_content), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


async def test_unauthenticated_gets_401(client, db_session):
    csv_content = _make_csv_bytes("client_name", "Acme Corp")

    resp = await client.post(
        "/api/csv-upload/upload",
        files={"file": ("orders.csv", io.BytesIO(csv_content), "text/csv")},
    )

    assert resp.status_code == 401
