from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import uuid
from datetime import UTC, datetime

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.webhook import Webhook, WebhookDelivery, WebhookEventType
from app.schemas.webhooks import WebhookCreate, WebhookUpdate


class WebhookService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, org_id: uuid.UUID, data: WebhookCreate) -> Webhook:
        valid_events = {e.value for e in WebhookEventType}
        for event in data.events:
            if event not in valid_events:
                raise ValueError(
                    f"Invalid event type: {event}. "
                    f"Valid types: {', '.join(sorted(valid_events))}"
                )

        webhook = Webhook(
            id=uuid.uuid4(),
            organization_id=org_id,
            name=data.name,
            url=data.url,
            secret=secrets.token_urlsafe(32),
            events=data.events,
            is_active=data.is_active,
            description=data.description,
        )
        self.session.add(webhook)
        await self.session.commit()
        await self.session.refresh(webhook)
        return webhook

    async def get(self, webhook_id: uuid.UUID, org_id: uuid.UUID) -> Webhook | None:
        result = await self.session.execute(
            select(Webhook).where(
                Webhook.id == webhook_id, Webhook.organization_id == org_id
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self, org_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[Webhook], int]:
        count_query = select(func.count(Webhook.id)).where(
            Webhook.organization_id == org_id
        )
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        query = (
            select(Webhook)
            .where(Webhook.organization_id == org_id)
            .order_by(Webhook.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all()), total

    async def update(
        self, webhook_id: uuid.UUID, org_id: uuid.UUID, data: WebhookUpdate
    ) -> Webhook:
        webhook = await self.get(webhook_id, org_id)
        if not webhook:
            raise ValueError("Webhook not found")

        update_data = data.model_dump(exclude_unset=True)

        if "events" in update_data:
            valid_events = {e.value for e in WebhookEventType}
            for event in update_data["events"]:
                if event not in valid_events:
                    raise ValueError(
                        f"Invalid event type: {event}. "
                        f"Valid types: {', '.join(sorted(valid_events))}"
                    )

        for key, value in update_data.items():
            setattr(webhook, key, value)

        await self.session.commit()
        await self.session.refresh(webhook)
        return webhook

    async def delete(self, webhook_id: uuid.UUID, org_id: uuid.UUID) -> None:
        webhook = await self.get(webhook_id, org_id)
        if not webhook:
            raise ValueError("Webhook not found")

        await self.session.delete(webhook)
        await self.session.commit()

    async def regenerate_secret(
        self, webhook_id: uuid.UUID, org_id: uuid.UUID
    ) -> Webhook:
        webhook = await self.get(webhook_id, org_id)
        if not webhook:
            raise ValueError("Webhook not found")

        webhook.secret = secrets.token_urlsafe(32)
        await self.session.commit()
        await self.session.refresh(webhook)
        return webhook

    async def get_deliveries(
        self, webhook_id: uuid.UUID, org_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[WebhookDelivery], int]:
        webhook = await self.get(webhook_id, org_id)
        if not webhook:
            raise ValueError("Webhook not found")

        count_query = select(func.count(WebhookDelivery.id)).where(
            WebhookDelivery.webhook_id == webhook_id
        )
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        query = (
            select(WebhookDelivery)
            .where(WebhookDelivery.webhook_id == webhook_id)
            .order_by(WebhookDelivery.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    def compute_signature(payload: bytes, secret: str) -> str:
        return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    @staticmethod
    def verify_signature(payload: bytes, secret: str, signature: str) -> bool:
        expected = WebhookService.compute_signature(payload, secret)
        return hmac.compare_digest(expected, signature)

    async def dispatch_event(
        self, org_id: uuid.UUID, event_type: str, payload: dict
    ) -> None:
        result = await self.session.execute(
            select(Webhook).where(
                Webhook.organization_id == org_id,
                Webhook.is_active.is_(True),
            )
        )
        webhooks = list(result.scalars().all())

        for webhook in webhooks:
            if event_type not in webhook.events:
                continue

            full_payload = {
                "event": event_type,
                "timestamp": datetime.now(UTC).isoformat(),
                "data": payload,
            }
            payload_bytes = json.dumps(full_payload).encode()
            signature = self.compute_signature(payload_bytes, webhook.secret)

            delivery = WebhookDelivery(
                id=uuid.uuid4(),
                organization_id=org_id,
                webhook_id=webhook.id,
                event_type=event_type,
                payload=full_payload,
            )

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        webhook.url,
                        content=payload_bytes,
                        headers={
                            "Content-Type": "application/json",
                            "X-Webhook-Signature": signature,
                            "X-Webhook-Event": event_type,
                        },
                    )
                    delivery.response_status = response.status_code
                    delivery.response_body = response.text[:2000]
                    delivery.success = 200 <= response.status_code < 300
                    delivery.delivered_at = datetime.now(UTC)
            except Exception as e:
                delivery.success = False
                delivery.error_message = str(e)[:2000]
                delivery.delivered_at = datetime.now(UTC)

            self.session.add(delivery)

        await self.session.commit()

    async def test_webhook(
        self, webhook_id: uuid.UUID, org_id: uuid.UUID
    ) -> WebhookDelivery:
        webhook = await self.get(webhook_id, org_id)
        if not webhook:
            raise ValueError("Webhook not found")

        test_payload = {
            "event": "webhook.test",
            "timestamp": datetime.now(UTC).isoformat(),
            "data": {"message": "This is a test webhook delivery"},
        }
        payload_bytes = json.dumps(test_payload).encode()
        signature = self.compute_signature(payload_bytes, webhook.secret)

        delivery = WebhookDelivery(
            id=uuid.uuid4(),
            organization_id=org_id,
            webhook_id=webhook.id,
            event_type="webhook.test",
            payload=test_payload,
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    webhook.url,
                    content=payload_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "X-Webhook-Signature": signature,
                        "X-Webhook-Event": "webhook.test",
                    },
                )
                delivery.response_status = response.status_code
                delivery.response_body = response.text[:2000]
                delivery.success = 200 <= response.status_code < 300
                delivery.delivered_at = datetime.now(UTC)
        except Exception as e:
            delivery.success = False
            delivery.error_message = str(e)[:2000]
            delivery.delivered_at = datetime.now(UTC)

        self.session.add(delivery)
        await self.session.commit()
        await self.session.refresh(delivery)
        return delivery

    async def handle_incoming(
        self,
        org_id: uuid.UUID,
        event: str,
        data: dict,
        raw_body: bytes,
        signature: str,
    ) -> dict:
        # Validate org exists
        org_result = await self.session.execute(
            select(Organization).where(Organization.id == org_id)
        )
        if not org_result.scalar_one_or_none():
            raise ValueError("Organization not found")

        # Find active webhooks for this org
        result = await self.session.execute(
            select(Webhook).where(
                Webhook.organization_id == org_id,
                Webhook.is_active.is_(True),
            )
        )
        webhooks = list(result.scalars().all())
        if not webhooks:
            raise ValueError("No active webhooks registered for this organization")

        # Verify signature against any registered webhook secret
        verified = False
        for webhook in webhooks:
            if self.verify_signature(raw_body, webhook.secret, signature):
                verified = True
                break

        if not verified:
            raise PermissionError("Invalid webhook signature")

        return {
            "status": "received",
            "event": event,
            "organization_id": str(org_id),
        }
