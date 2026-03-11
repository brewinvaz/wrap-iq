import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.auth.permissions import require_role
from app.models.invoice import InvoiceStatus
from app.models.user import Role, User
from app.schemas.invoices import (
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceUpdate,
    PaymentCreate,
    PaymentResponse,
)
from app.services.invoices import InvoiceService

logger = logging.getLogger("wrapiq")

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = InvoiceService(session)
    invoice = await service.create(
        org_id=user.organization_id,
        client_name=data.client_name,
        client_email=data.client_email,
        subtotal=data.subtotal,
        tax_rate=data.tax_rate,
        due_date=data.due_date,
        work_order_id=data.work_order_id,
        estimate_id=data.estimate_id,
        notes=data.notes,
    )
    return invoice


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    status_filter: InvoiceStatus | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = InvoiceService(session)
    items, total = await service.list(user.organization_id, status_filter)
    return InvoiceListResponse(items=items, total=total)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = InvoiceService(session)
    invoice = await service.get(invoice_id, user.organization_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = InvoiceService(session)
    invoice = await service.update(
        invoice_id,
        user.organization_id,
        **data.model_dump(exclude_unset=True),
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post(
    "/{invoice_id}/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_payment(
    invoice_id: uuid.UUID,
    data: PaymentCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = InvoiceService(session)
    try:
        payment = await service.record_payment(
            invoice_id,
            user.organization_id,
            amount=data.amount,
            payment_method=data.payment_method,
            reference=data.reference,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to record payment for invoice %s", invoice_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    if not payment:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return payment


@router.post("/{invoice_id}/payment-link")
async def create_payment_link(
    invoice_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = InvoiceService(session)
    link = await service.generate_payment_link(invoice_id, user.organization_id)
    if not link:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"payment_link": link}
