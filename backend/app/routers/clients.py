import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.user import User
from app.schemas.clients import (
    ClientAggregateReport,
    ClientCreate,
    ClientDetailResponse,
    ClientListItemResponse,
    ClientListResponse,
    ClientResponse,
    ClientUpdate,
)
from app.services.clients import ClientService

logger = logging.getLogger("wrapiq")

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = ClientService(session)
    try:
        client = await service.create(user.organization_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to create client")
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return client


@router.get("", response_model=ClientListResponse)
async def list_clients(
    parent_only: bool = Query(False),
    parent_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = ClientService(session)
    items, total = await service.list(
        user.organization_id, parent_only, parent_id, skip, limit
    )
    return ClientListResponse(
        items=[
            ClientListItemResponse(
                **ClientResponse.model_validate(row["client"]).model_dump(),
                project_count=row["project_count"],
                total_revenue=row["total_revenue"],
            )
            for row in items
        ],
        total=total,
    )


@router.get("/{client_id}", response_model=ClientDetailResponse)
async def get_client(
    client_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = ClientService(session)
    client = await service.get(client_id, user.organization_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    work_orders = client.work_orders or []
    return ClientDetailResponse(
        id=client.id,
        name=client.name,
        client_type=client.client_type,
        email=client.email,
        phone=client.phone,
        address=client.address,
        tags=client.tags or [],
        referral_source=client.referral_source,
        notes=client.notes,
        is_active=client.is_active,
        parent_id=client.parent_id,
        created_at=client.created_at,
        updated_at=client.updated_at,
        sub_clients=[ClientResponse.model_validate(sc) for sc in client.sub_clients],
        project_count=len(work_orders),
        total_revenue=sum(wo.job_value for wo in work_orders),
    )


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    data: ClientUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = ClientService(session)
    try:
        client = await service.update(client_id, user.organization_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to update client %s", client_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return client


@router.post(
    "/{client_id}/sub-clients",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_sub_client(
    client_id: uuid.UUID,
    data: ClientCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = ClientService(session)
    try:
        client = await service.add_sub_client(client_id, user.organization_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to create sub-client for %s", client_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return client


@router.get("/{client_id}/report", response_model=ClientAggregateReport)
async def get_aggregate_report(
    client_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = ClientService(session)
    try:
        report = await service.get_aggregate_report(client_id, user.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        logger.exception("Failed to get aggregate report for client %s", client_id)
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return report
