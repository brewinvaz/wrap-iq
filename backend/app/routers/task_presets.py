import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.task_preset import TaskPreset
from app.models.user import Role, User
from app.schemas.task_presets import (
    TaskPresetCreate,
    TaskPresetListResponse,
    TaskPresetResponse,
    TaskPresetUpdate,
)
from app.services.task_presets import TaskPresetService

router = APIRouter(prefix="/api/task-presets", tags=["task-presets"])


def _require_admin(user: User) -> None:
    if user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage task presets",
        )


def _to_response(preset: TaskPreset) -> TaskPresetResponse:
    return TaskPresetResponse(
        id=preset.id,
        organization_id=preset.organization_id,
        phase=preset.phase.value if hasattr(preset.phase, "value") else preset.phase,
        name=preset.name,
        sort_order=preset.sort_order,
        is_active=preset.is_active,
        created_at=preset.created_at,
        updated_at=preset.updated_at,
    )


@router.get("", response_model=TaskPresetListResponse)
async def list_task_presets(
    phase: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = TaskPresetService(session)
    include_inactive = user.role == Role.ADMIN
    items, total = await service.list_presets(
        organization_id=user.organization_id,
        phase=phase,
        include_inactive=include_inactive,
    )
    return TaskPresetListResponse(
        items=[_to_response(p) for p in items],
        total=total,
    )


@router.post(
    "", response_model=TaskPresetResponse, status_code=status.HTTP_201_CREATED
)
async def create_task_preset(
    data: TaskPresetCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)

    preset = TaskPreset(
        id=uuid.uuid4(),
        organization_id=user.organization_id,
        **data.model_dump(),
    )
    session.add(preset)
    await session.commit()
    await session.refresh(preset)
    return _to_response(preset)


@router.patch("/{preset_id}", response_model=TaskPresetResponse)
async def update_task_preset(
    preset_id: uuid.UUID,
    data: TaskPresetUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)

    service = TaskPresetService(session)
    preset = await service.get_by_id(preset_id, user.organization_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Task preset not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(preset, field, value)

    await session.commit()
    await session.refresh(preset)
    return _to_response(preset)


@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_preset(
    preset_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)

    service = TaskPresetService(session)
    preset = await service.get_by_id(preset_id, user.organization_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Task preset not found")

    await session.delete(preset)
    await session.commit()
