import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.auth.permissions import require_role
from app.models.estimate import EstimateStatus
from app.models.user import Role, User
from app.schemas.estimates import (
    EstimateCreate,
    EstimateListResponse,
    EstimateResponse,
    EstimateUpdate,
    LineItemCreate,
    LineItemResponse,
)
from app.services.estimates import EstimateService

router = APIRouter(prefix="/api/estimates", tags=["estimates"])


@router.post("", response_model=EstimateResponse, status_code=status.HTTP_201_CREATED)
async def create_estimate(
    data: EstimateCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = EstimateService(session)
    estimate = await service.create(
        org_id=user.organization_id,
        client_name=data.client_name,
        client_email=data.client_email,
        line_items=[li.model_dump() for li in data.line_items],
        tax_rate=data.tax_rate,
        notes=data.notes,
        work_order_id=data.work_order_id,
        valid_until=data.valid_until,
    )
    return estimate


@router.get("", response_model=EstimateListResponse)
async def list_estimates(
    status_filter: EstimateStatus | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EstimateService(session)
    items, total = await service.list(user.organization_id, status_filter)
    return EstimateListResponse(items=items, total=total)


@router.get("/{estimate_id}", response_model=EstimateResponse)
async def get_estimate(
    estimate_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EstimateService(session)
    estimate = await service.get(estimate_id, user.organization_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return estimate


@router.patch("/{estimate_id}", response_model=EstimateResponse)
async def update_estimate(
    estimate_id: uuid.UUID,
    data: EstimateUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = EstimateService(session)
    estimate = await service.update(
        estimate_id, user.organization_id, **data.model_dump(exclude_unset=True)
    )
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return estimate


@router.post(
    "/{estimate_id}/line-items",
    response_model=LineItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_line_item(
    estimate_id: uuid.UUID,
    data: LineItemCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = EstimateService(session)
    item = await service.add_line_item(
        estimate_id,
        user.organization_id,
        description=data.description,
        quantity=data.quantity,
        unit_price=data.unit_price,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return item


@router.delete(
    "/{estimate_id}/line-items/{line_item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_line_item(
    estimate_id: uuid.UUID,
    line_item_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = EstimateService(session)
    removed = await service.remove_line_item(
        line_item_id, estimate_id, user.organization_id
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Line item not found")


@router.post("/{estimate_id}/send", response_model=EstimateResponse)
async def send_estimate(
    estimate_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = EstimateService(session)
    estimate = await service.send(estimate_id, user.organization_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return estimate


@router.post("/{estimate_id}/convert-to-invoice")
async def convert_to_invoice(
    estimate_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_role(Role.ADMIN, Role.PROJECT_MANAGER)),
):
    service = EstimateService(session)
    try:
        invoice = await service.convert_to_invoice(estimate_id, user.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not invoice:
        raise HTTPException(status_code=404, detail="Estimate not found")

    from app.schemas.invoices import InvoiceResponse

    return InvoiceResponse.model_validate(invoice)
