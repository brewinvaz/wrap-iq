from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.schemas.invoices import PaymentPageResponse
from app.services.invoices import InvoiceService

router = APIRouter(prefix="/api/pay", tags=["pay"])


@router.get("/{token}", response_model=PaymentPageResponse)
async def get_payment_page(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    service = InvoiceService(session)
    invoice = await service.get_by_payment_token(token)
    if not invoice:
        raise HTTPException(status_code=404, detail="Payment link not found")
    return invoice
