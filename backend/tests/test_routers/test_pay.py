import uuid


async def _register(client):
    """Register a user and return their access token."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "Testpass123",
            "org_name": "My Shop",
        },
    )
    return resp.json()["access_token"]


async def _create_invoice_with_payment_link(client, token):
    """Create an invoice and generate a payment link.

    Returns (invoice_id, pay_token).
    """
    create_resp = await client.post(
        "/api/invoices",
        json={
            "client_name": "Jane Doe",
            "client_email": "jane@example.com",
            "subtotal": 50000,
            "tax_rate": "10",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    invoice_id = create_resp.json()["id"]

    link_resp = await client.post(
        f"/api/invoices/{invoice_id}/payment-link",
        headers={"Authorization": f"Bearer {token}"},
    )
    payment_link = link_resp.json()["payment_link"]
    # payment_link is "/pay/<hex_token>"
    pay_token = payment_link.split("/pay/")[1]
    return invoice_id, pay_token


async def test_get_payment_page(client, db_session):
    auth_token = await _register(client)
    _invoice_id, pay_token = await _create_invoice_with_payment_link(client, auth_token)

    resp = await client.get(f"/api/pay/{pay_token}")
    assert resp.status_code == 200

    data = resp.json()
    assert data["invoice_number"] == "INV-1001"
    assert data["client_name"] == "Jane Doe"
    assert data["total"] == 55000
    assert data["balance_due"] == 55000
    assert data["status"] == "draft"


async def test_get_payment_page_not_found(client, db_session):
    resp = await client.get(f"/api/pay/{uuid.uuid4().hex}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Payment link not found"


async def test_get_payment_page_no_auth_required(client, db_session):
    """The payment page endpoint should not require authentication."""
    auth_token = await _register(client)
    _invoice_id, pay_token = await _create_invoice_with_payment_link(client, auth_token)

    # Access without any Authorization header
    resp = await client.get(f"/api/pay/{pay_token}")
    assert resp.status_code == 200
    assert resp.json()["client_name"] == "Jane Doe"


async def test_payment_page_does_not_expose_sensitive_fields(client, db_session):
    """Ensure the payment page response does not include org ID or payment link."""
    auth_token = await _register(client)
    _invoice_id, pay_token = await _create_invoice_with_payment_link(client, auth_token)

    resp = await client.get(f"/api/pay/{pay_token}")
    assert resp.status_code == 200

    data = resp.json()
    assert "organization_id" not in data
    assert "payment_link" not in data
    assert "client_email" not in data
    assert "notes" not in data
