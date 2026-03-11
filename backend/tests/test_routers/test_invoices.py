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


async def test_create_invoice(client, db_session):
    token = await _register(client)

    resp = await client.post(
        "/api/invoices",
        json={
            "client_name": "Jane Doe",
            "client_email": "jane@example.com",
            "subtotal": 100000,
            "tax_rate": "8",
            "notes": "Net 30",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["invoice_number"] == "INV-1001"
    assert data["client_name"] == "Jane Doe"
    assert data["status"] == "draft"
    assert data["subtotal"] == 100000
    assert data["total"] == 108000
    assert data["balance_due"] == 108000


async def test_list_invoices(client, db_session):
    token = await _register(client)

    await client.post(
        "/api/invoices",
        json={
            "client_name": "A",
            "client_email": "a@x.com",
            "subtotal": 1000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get(
        "/api/invoices",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1


async def test_get_invoice(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/invoices",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "subtotal": 5000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    invoice_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/invoices/{invoice_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["client_name"] == "John"


async def test_update_invoice(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/invoices",
        json={
            "client_name": "Old",
            "client_email": "old@x.com",
            "subtotal": 1000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    invoice_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/invoices/{invoice_id}",
        json={"client_name": "New", "notes": "Updated"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["client_name"] == "New"
    assert resp.json()["notes"] == "Updated"


async def test_record_payment(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/invoices",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "subtotal": 10000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    invoice_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/invoices/{invoice_id}/payments",
        json={"amount": 5000, "payment_method": "card", "reference": "txn_123"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["amount"] == 5000

    # Check invoice updated
    inv_resp = await client.get(
        f"/api/invoices/{invoice_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert inv_resp.json()["amount_paid"] == 5000
    assert inv_resp.json()["balance_due"] == 5000
    assert inv_resp.json()["status"] == "partial"


async def test_record_full_payment(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/invoices",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "subtotal": 5000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    invoice_id = create_resp.json()["id"]

    await client.post(
        f"/api/invoices/{invoice_id}/payments",
        json={"amount": 5000},
        headers={"Authorization": f"Bearer {token}"},
    )

    inv_resp = await client.get(
        f"/api/invoices/{invoice_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert inv_resp.json()["status"] == "paid"
    assert inv_resp.json()["balance_due"] == 0


async def test_create_payment_link(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/invoices",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "subtotal": 5000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    invoice_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/invoices/{invoice_id}/payment-link",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["payment_link"].startswith("/pay/")


async def test_get_invoice_not_found(client, db_session):
    token = await _register(client)
    import uuid

    resp = await client.get(
        f"/api/invoices/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


async def test_invoice_requires_auth(client, db_session):
    resp = await client.get("/api/invoices")
    assert resp.status_code == 401


async def test_payment_exceeds_balance(client, db_session):
    token = await _register(client)

    create_resp = await client.post(
        "/api/invoices",
        json={
            "client_name": "John",
            "client_email": "john@x.com",
            "subtotal": 1000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    invoice_id = create_resp.json()["id"]

    resp = await client.post(
        f"/api/invoices/{invoice_id}/payments",
        json={"amount": 9999},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
