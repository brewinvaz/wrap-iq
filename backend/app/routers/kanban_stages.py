import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.auth.permissions import require_admin
from app.models.user import User
from app.schemas.kanban_stages import (
    KanbanStageCreate,
    KanbanStageResponse,
    KanbanStageUpdate,
    ReorderRequest,
)
from app.services.kanban_stages import KanbanStageService

router = APIRouter(prefix="/api/kanban-stages", tags=["kanban-stages"])


@router.get("", response_model=list[KanbanStageResponse])
async def list_stages(
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List all active Kanban stages for the organization."""
    service = KanbanStageService(session)
    stages = await service.list_stages(admin.organization_id)
    return stages


@router.post(
    "", response_model=KanbanStageResponse, status_code=status.HTTP_201_CREATED
)
async def create_stage(
    body: KanbanStageCreate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Create a new Kanban stage. Admin only."""
    service = KanbanStageService(session)
    stage = await service.create(
        organization_id=admin.organization_id,
        name=body.name,
        color=body.color,
        position=body.position,
        system_status=body.system_status,
        is_default=body.is_default,
    )
    return stage


@router.patch("/{stage_id}", response_model=KanbanStageResponse)
async def update_stage(
    stage_id: uuid.UUID,
    body: KanbanStageUpdate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update a Kanban stage. Admin only."""
    service = KanbanStageService(session)
    update_data = body.model_dump(exclude_unset=True)
    stage = await service.update_stage(
        stage_id=stage_id,
        organization_id=admin.organization_id,
        **update_data,
    )
    if not stage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stage not found",
        )
    return stage


@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stage(
    stage_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Soft-delete a Kanban stage. Admin only. Cannot delete system-mapped stages."""
    service = KanbanStageService(session)
    stage = await service.get_by_id(stage_id, admin.organization_id)
    if not stage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stage not found",
        )
    if stage.system_status is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a stage with a system status mapping",
        )
    stage.is_active = False
    await session.commit()


@router.post("/reorder", response_model=list[KanbanStageResponse])
async def reorder_stages(
    body: ReorderRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Reorder Kanban stages. Admin only."""
    service = KanbanStageService(session)
    items = [{"id": item.id, "position": item.position} for item in body.stages]
    stages = await service.reorder(admin.organization_id, items)
    return stages
