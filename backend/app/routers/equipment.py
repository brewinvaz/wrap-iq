import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.equipment import EquipmentType
from app.models.user import User
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentListResponse,
    EquipmentResponse,
    EquipmentStats,
    EquipmentUpdate,
)
from app.services.equipment import EquipmentService

logger = logging.getLogger("wrapiq")

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    data: EquipmentCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    try:
        equipment = await service.create(user.organization_id, data)
    except Exception as e:
        logger.exception("Failed to create equipment")
        raise HTTPException(
            status_code=500, detail="An unexpected error occurred"
        ) from e
    return equipment


@router.get("", response_model=EquipmentListResponse)
async def list_equipment(
    search: str | None = Query(None, max_length=200),
    equipment_type: EquipmentType | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    items, total = await service.list(
        user.organization_id,
        equipment_type=equipment_type,
        is_active=is_active,
        search=search,
        skip=skip,
        limit=limit,
    )
    return EquipmentListResponse(
        items=[EquipmentResponse.model_validate(eq) for eq in items],
        total=total,
    )


@router.get("/stats", response_model=EquipmentStats)
async def get_equipment_stats(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    return await service.get_stats(user.organization_id)


@router.get("/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(
    equipment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    equipment = await service.get(equipment_id, user.organization_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.patch("/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: uuid.UUID,
    data: EquipmentUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    try:
        equipment = await service.update(equipment_id, user.organization_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return equipment


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    equipment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    try:
        await service.delete(equipment_id, user.organization_id)
    except ValueError as e:
        detail = str(e)
        if "assigned to work orders" in detail:
            raise HTTPException(status_code=409, detail=detail) from e
        raise HTTPException(status_code=404, detail=detail) from e
