import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.time_log import TimeLog, TimeLogStatus
from app.models.user import User
from app.schemas.time_logs import (
    TimeLogCreate,
    TimeLogListResponse,
    TimeLogResponse,
    TimeLogSummaryResponse,
)

router = APIRouter(prefix="/api/time-logs", tags=["time-logs"])


def _to_response(tl: TimeLog) -> TimeLogResponse:
    return TimeLogResponse(
        id=tl.id,
        user={
            "id": tl.user.id,
            "email": tl.user.email,
            "full_name": tl.user.full_name,
        },
        work_order={
            "id": tl.work_order.id,
            "job_number": tl.work_order.job_number,
        }
        if tl.work_order
        else None,
        task=tl.task,
        hours=tl.hours,
        log_date=tl.log_date,
        status=tl.status.value,
        notes=tl.notes,
        created_at=tl.created_at,
        updated_at=tl.updated_at,
    )


@router.get("", response_model=TimeLogListResponse)
async def list_time_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    query = select(TimeLog).where(TimeLog.organization_id == user.organization_id)
    count_query = (
        select(func.count())
        .select_from(TimeLog)
        .where(TimeLog.organization_id == user.organization_id)
    )

    if status_filter:
        query = query.where(TimeLog.status == status_filter)
        count_query = count_query.where(TimeLog.status == status_filter)

    query = query.order_by(TimeLog.log_date.desc(), TimeLog.created_at.desc())
    query = query.offset(skip).limit(limit)

    result = await session.execute(query)
    items = list(result.scalars().all())

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    return TimeLogListResponse(
        items=[_to_response(tl) for tl in items],
        total=total,
    )


@router.get("/summary", response_model=TimeLogSummaryResponse)
async def get_summary(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Total hours
    total_q = select(func.coalesce(func.sum(TimeLog.hours), 0)).where(
        TimeLog.organization_id == user.organization_id
    )
    total_result = await session.execute(total_q)
    total_hours = total_result.scalar() or 0

    # Pending hours
    pending_q = select(func.coalesce(func.sum(TimeLog.hours), 0)).where(
        TimeLog.organization_id == user.organization_id,
        TimeLog.status == TimeLogStatus.SUBMITTED,
    )
    pending_result = await session.execute(pending_q)
    pending_hours = pending_result.scalar() or 0

    # Approved hours
    approved_q = select(func.coalesce(func.sum(TimeLog.hours), 0)).where(
        TimeLog.organization_id == user.organization_id,
        TimeLog.status == TimeLogStatus.APPROVED,
    )
    approved_result = await session.execute(approved_q)
    approved_hours = approved_result.scalar() or 0

    # Unique members
    members_q = select(func.count(func.distinct(TimeLog.user_id))).where(
        TimeLog.organization_id == user.organization_id
    )
    members_result = await session.execute(members_q)
    unique_members = members_result.scalar() or 0

    return TimeLogSummaryResponse(
        total_hours=total_hours,
        pending_hours=pending_hours,
        approved_hours=approved_hours,
        unique_members=unique_members,
    )


@router.post("", response_model=TimeLogResponse, status_code=status.HTTP_201_CREATED)
async def create_time_log(
    data: TimeLogCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    tl = TimeLog(
        user_id=user.id,
        organization_id=user.organization_id,
        work_order_id=data.work_order_id,
        task=data.task,
        hours=data.hours,
        log_date=data.log_date,
        notes=data.notes,
    )
    session.add(tl)
    await session.commit()
    await session.refresh(tl)
    return _to_response(tl)


@router.patch("/{time_log_id}/approve", response_model=TimeLogResponse)
async def approve_time_log(
    time_log_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    result = await session.execute(
        select(TimeLog).where(
            TimeLog.id == time_log_id,
            TimeLog.organization_id == user.organization_id,
        )
    )
    tl = result.scalar_one_or_none()
    if not tl:
        raise HTTPException(status_code=404, detail="Time log not found")
    if tl.status == TimeLogStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Already approved")

    tl.status = TimeLogStatus.APPROVED
    await session.commit()
    await session.refresh(tl)
    return _to_response(tl)
