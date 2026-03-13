import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.estimate_defaults import EstimateDefaults
from app.models.user import Role, User
from app.schemas.estimate_defaults import (
    EstimateDefaultsCreate,
    EstimateDefaultsListResponse,
    EstimateDefaultsResponse,
    EstimateDefaultsUpdate,
)

router = APIRouter(prefix="/api/estimate-defaults", tags=["estimate-defaults"])


def _require_admin(user: User) -> None:
    if user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage estimate defaults",
        )


def _to_response(rule: EstimateDefaults) -> EstimateDefaultsResponse:
    return EstimateDefaultsResponse(
        id=rule.id,
        organization_id=rule.organization_id,
        job_type=rule.job_type.value if rule.job_type else None,
        vehicle_count_min=rule.vehicle_count_min,
        vehicle_count_max=rule.vehicle_count_max,
        wrap_coverage=rule.wrap_coverage.value if rule.wrap_coverage else None,
        vehicle_type=rule.vehicle_type.value if rule.vehicle_type else None,
        design_hours=rule.design_hours,
        production_hours=rule.production_hours,
        install_hours=rule.install_hours,
        priority=rule.priority,
        is_active=rule.is_active,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


@router.get("", response_model=EstimateDefaultsListResponse)
async def list_estimate_defaults(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)

    base = select(EstimateDefaults).where(
        EstimateDefaults.organization_id == user.organization_id
    )
    count_query = (
        select(func.count())
        .select_from(EstimateDefaults)
        .where(EstimateDefaults.organization_id == user.organization_id)
    )

    query = base.order_by(EstimateDefaults.priority.desc()).offset(skip).limit(limit)

    result = await session.execute(query)
    items = list(result.scalars().all())

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    return EstimateDefaultsListResponse(
        items=[_to_response(r) for r in items],
        total=total,
    )


@router.post(
    "", response_model=EstimateDefaultsResponse, status_code=status.HTTP_201_CREATED
)
async def create_estimate_default(
    data: EstimateDefaultsCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)

    rule = EstimateDefaults(
        organization_id=user.organization_id,
        **data.model_dump(),
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return _to_response(rule)


@router.patch("/{rule_id}", response_model=EstimateDefaultsResponse)
async def update_estimate_default(
    rule_id: uuid.UUID,
    data: EstimateDefaultsUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)

    result = await session.execute(
        select(EstimateDefaults).where(
            EstimateDefaults.id == rule_id,
            EstimateDefaults.organization_id == user.organization_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Estimate default not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    await session.commit()
    await session.refresh(rule)
    return _to_response(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_estimate_default(
    rule_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_admin(user)

    result = await session.execute(
        select(EstimateDefaults).where(
            EstimateDefaults.id == rule_id,
            EstimateDefaults.organization_id == user.organization_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Estimate default not found")

    await session.delete(rule)
    await session.commit()
