import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.auth.permissions import require_admin
from app.models.user import User
from app.schemas.webhooks import (
    IncomingWebhookPayload,
    WebhookCreate,
    WebhookDeliveryListResponse,
    WebhookDeliveryResponse,
    WebhookListResponse,
    WebhookResponse,
    WebhookUpdate,
)
from app.services.webhooks import WebhookService

logger = logging.getLogger("wrapiq")

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    data: WebhookCreate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = WebhookService(session)
    try:
        webhook = await service.create(admin.organization_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to create webhook")
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return webhook


@router.get("", response_model=WebhookListResponse)
async def list_webhooks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = WebhookService(session)
    items, total = await service.list(admin.organization_id, skip, limit)
    return WebhookListResponse(
        items=[WebhookResponse.model_validate(w) for w in items],
        total=total,
    )


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = WebhookService(session)
    webhook = await service.get(webhook_id, admin.organization_id)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return webhook


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: uuid.UUID,
    data: WebhookUpdate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = WebhookService(session)
    try:
        webhook = await service.update(webhook_id, admin.organization_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to update webhook %s", webhook_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return webhook


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = WebhookService(session)
    try:
        await service.delete(webhook_id, admin.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to delete webhook %s", webhook_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e


@router.post("/{webhook_id}/regenerate-secret", response_model=WebhookResponse)
async def regenerate_secret(
    webhook_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = WebhookService(session)
    try:
        webhook = await service.regenerate_secret(webhook_id, admin.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to regenerate secret for webhook %s", webhook_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return webhook


@router.get("/{webhook_id}/deliveries", response_model=WebhookDeliveryListResponse)
async def get_deliveries(
    webhook_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = WebhookService(session)
    try:
        items, total = await service.get_deliveries(
            webhook_id, admin.organization_id, skip, limit
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to get deliveries for webhook %s", webhook_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return WebhookDeliveryListResponse(
        items=[WebhookDeliveryResponse.model_validate(d) for d in items],
        total=total,
    )


@router.post("/{webhook_id}/test", response_model=WebhookDeliveryResponse)
async def test_webhook(
    webhook_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = WebhookService(session)
    try:
        delivery = await service.test_webhook(webhook_id, admin.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to test webhook %s", webhook_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return delivery


@router.post("/incoming/{org_id}")
async def incoming_webhook(
    org_id: uuid.UUID,
    body: IncomingWebhookPayload,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    signature = request.headers.get("X-Webhook-Signature")
    if not signature:
        raise HTTPException(status_code=401, detail="Missing webhook signature")

    service = WebhookService(session)
    result = await service.handle_incoming(org_id, body.event, body.data)
    return result
