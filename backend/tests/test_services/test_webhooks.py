import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.models.organization import Organization
from app.models.plan import Plan
from app.schemas.webhooks import WebhookCreate, WebhookUpdate
from app.services.webhooks import WebhookService


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


async def test_create_webhook(db_session):
    org = await _seed(db_session)
    service = WebhookService(db_session)

    webhook = await service.create(
        org.id,
        WebhookCreate(
            name="My Webhook",
            url="https://example.com/webhook",
            events=["project.created", "client.created"],
        ),
    )
    assert webhook.name == "My Webhook"
    assert webhook.url == "https://example.com/webhook"
    assert webhook.events == ["project.created", "client.created"]
    assert webhook.is_active is True
    assert webhook.secret is not None
    assert len(webhook.secret) > 10
    assert webhook.organization_id == org.id


async def test_create_webhook_invalid_event_type(db_session):
    org = await _seed(db_session)
    service = WebhookService(db_session)

    with pytest.raises(ValueError, match="Invalid event type"):
        await service.create(
            org.id,
            WebhookCreate(
                name="Bad Webhook",
                url="https://example.com/webhook",
                events=["invalid.event"],
            ),
        )


async def test_list_webhooks(db_session):
    org = await _seed(db_session)
    service = WebhookService(db_session)

    await service.create(
        org.id,
        WebhookCreate(
            name="Webhook A",
            url="https://a.com/hook",
            events=["project.created"],
        ),
    )
    await service.create(
        org.id,
        WebhookCreate(
            name="Webhook B",
            url="https://b.com/hook",
            events=["client.created"],
        ),
    )

    items, total = await service.list(org.id)
    assert total == 2
    assert len(items) == 2


async def test_update_webhook(db_session):
    org = await _seed(db_session)
    service = WebhookService(db_session)

    webhook = await service.create(
        org.id,
        WebhookCreate(
            name="Original",
            url="https://example.com/hook",
            events=["project.created"],
        ),
    )

    updated = await service.update(
        webhook.id,
        org.id,
        WebhookUpdate(name="Updated", is_active=False),
    )
    assert updated.name == "Updated"
    assert updated.is_active is False
    assert updated.url == "https://example.com/hook"


async def test_delete_webhook(db_session):
    org = await _seed(db_session)
    service = WebhookService(db_session)

    webhook = await service.create(
        org.id,
        WebhookCreate(
            name="To Delete",
            url="https://example.com/hook",
            events=["project.created"],
        ),
    )

    await service.delete(webhook.id, org.id)

    result = await service.get(webhook.id, org.id)
    assert result is None


async def test_regenerate_secret(db_session):
    org = await _seed(db_session)
    service = WebhookService(db_session)

    webhook = await service.create(
        org.id,
        WebhookCreate(
            name="Regen",
            url="https://example.com/hook",
            events=["project.created"],
        ),
    )
    old_secret = webhook.secret

    updated = await service.regenerate_secret(webhook.id, org.id)
    assert updated.secret != old_secret
    assert len(updated.secret) > 10


async def test_compute_and_verify_signature():
    payload = b'{"event": "test"}'
    secret = "my-secret-key"

    signature = WebhookService.compute_signature(payload, secret)
    assert isinstance(signature, str)
    assert len(signature) == 64  # SHA-256 hex digest

    assert WebhookService.verify_signature(payload, secret, signature) is True
    assert WebhookService.verify_signature(payload, secret, "bad-sig") is False
    assert WebhookService.verify_signature(b"other", secret, signature) is False


async def test_dispatch_event(db_session):
    org = await _seed(db_session)
    service = WebhookService(db_session)

    webhook = await service.create(
        org.id,
        WebhookCreate(
            name="Dispatch Test",
            url="https://example.com/hook",
            events=["project.created"],
        ),
    )

    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.text = "OK"

    with patch("app.services.webhooks.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        await service.dispatch_event(
            org.id, "project.created", {"id": "123", "name": "Test Project"}
        )

    deliveries, total = await service.get_deliveries(webhook.id, org.id)
    assert total == 1
    assert deliveries[0].success is True
    assert deliveries[0].response_status == 200
    assert deliveries[0].event_type == "project.created"


async def test_dispatch_event_failure(db_session):
    org = await _seed(db_session)
    service = WebhookService(db_session)

    webhook = await service.create(
        org.id,
        WebhookCreate(
            name="Fail Test",
            url="https://example.com/hook",
            events=["client.created"],
        ),
    )

    with patch("app.services.webhooks.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(side_effect=Exception("Connection refused"))
        mock_client_class.return_value = mock_client

        await service.dispatch_event(
            org.id, "client.created", {"id": "456", "name": "New Client"}
        )

    deliveries, total = await service.get_deliveries(webhook.id, org.id)
    assert total == 1
    assert deliveries[0].success is False
    assert "Connection refused" in deliveries[0].error_message
