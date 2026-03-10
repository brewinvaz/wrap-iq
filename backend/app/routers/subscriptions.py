import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.subscription import (
    InvoiceListResponse,
    PaymentMethodCreate,
    PaymentMethodResponse,
    PlanResponse,
    SubscriptionCreate,
    SubscriptionResponse,
    UsageMetrics,
)
from app.services.subscription_service import SubscriptionService

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


# --- Plans ---


@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = SubscriptionService(session)
    return await service.get_plans()


# --- Subscription ---


@router.get("/current", response_model=SubscriptionResponse | None)
async def get_current_subscription(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    return await service.get_subscription(user.organization_id)


@router.post(
    "", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED
)
async def create_or_update_subscription(
    body: SubscriptionCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    existing = await service.get_subscription(user.organization_id)
    if existing:
        updated = await service.update_subscription(
            user.organization_id, body.plan_id
        )
        return updated
    return await service.create_subscription(user.organization_id, body.plan_id)


@router.post("/cancel", response_model=SubscriptionResponse)
async def cancel_subscription(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    subscription = await service.cancel_subscription(user.organization_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found",
        )
    return subscription


# --- Payment Methods ---


@router.get("/payment-methods", response_model=list[PaymentMethodResponse])
async def list_payment_methods(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    return await service.list_payment_methods(user.organization_id)


@router.post(
    "/payment-methods",
    response_model=PaymentMethodResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_payment_method(
    body: PaymentMethodCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    return await service.add_payment_method(
        user.organization_id, body.model_dump()
    )


@router.delete("/payment-methods/{pm_id}", response_model=MessageResponse)
async def remove_payment_method(
    pm_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    deleted = await service.remove_payment_method(pm_id, user.organization_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )
    return MessageResponse(message="Payment method removed")


@router.put(
    "/payment-methods/{pm_id}/default", response_model=PaymentMethodResponse
)
async def set_default_payment_method(
    pm_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    pm = await service.set_default_payment_method(pm_id, user.organization_id)
    if not pm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found",
        )
    return pm


# --- Invoices ---


@router.get("/invoices", response_model=InvoiceListResponse)
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    items, total = await service.list_invoices(
        user.organization_id, skip, limit
    )
    return InvoiceListResponse(items=items, total=total)


# --- Usage ---


@router.get("/usage", response_model=UsageMetrics)
async def get_usage(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = SubscriptionService(session)
    return await service.get_usage_metrics(user.organization_id)
