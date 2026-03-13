from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.design_details import DesignDetails
from app.models.install_details import InstallDetails
from app.models.organization import Organization
from app.models.production_details import ProductionDetails
from app.models.time_log import Phase, TimeLog
from app.models.user import Role, User
from app.models.work_order import WorkOrder
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    HoursByMemberResponse,
    JobRankedItem,
    JobsRankedResponse,
    MemberHoursItem,
    PhaseEfficiencyItem,
    PhaseEfficiencyResponse,
    RoiTrendItem,
    RoiTrendResponse,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

MANAGER_ROLES = {Role.ADMIN, Role.PROJECT_MANAGER}


def _require_manager(user: User):
    if user.role not in MANAGER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and project managers can view analytics",
        )


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_summary(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_manager(user)
    org_id = user.organization_id

    # Total hours
    hours_q = select(func.coalesce(func.sum(TimeLog.hours), 0)).where(
        TimeLog.organization_id == org_id
    )
    if start_date:
        hours_q = hours_q.where(TimeLog.log_date >= start_date)
    if end_date:
        hours_q = hours_q.where(TimeLog.log_date <= end_date)
    total_hours = (await session.execute(hours_q)).scalar() or Decimal(0)

    # Completed jobs
    completed_q = (
        select(func.count())
        .select_from(WorkOrder)
        .join(WorkOrder.status)
        .where(
            WorkOrder.organization_id == org_id,
        )
        .where(WorkOrder.completion_date.is_not(None))
    )
    if start_date:
        completed_q = completed_q.where(
            func.date(WorkOrder.completion_date) >= start_date
        )
    if end_date:
        completed_q = completed_q.where(
            func.date(WorkOrder.completion_date) <= end_date
        )
    total_jobs_completed = (await session.execute(completed_q)).scalar() or 0

    # Avg effective rate: for completed jobs with time logged,
    # compute (job_value/100) / sum(hours) per job, then average
    rate_subq = (
        select(
            WorkOrder.id,
            (WorkOrder.job_value / 100.0 / func.sum(TimeLog.hours)).label(
                "effective_rate"
            ),
        )
        .join(TimeLog, TimeLog.work_order_id == WorkOrder.id)
        .where(
            WorkOrder.organization_id == org_id,
            WorkOrder.completion_date.is_not(None),
        )
        .group_by(WorkOrder.id)
        .having(func.sum(TimeLog.hours) > 0)
    )
    if start_date:
        rate_subq = rate_subq.where(
            func.date(WorkOrder.completion_date) >= start_date
        )
    if end_date:
        rate_subq = rate_subq.where(
            func.date(WorkOrder.completion_date) <= end_date
        )
    rate_subq = rate_subq.subquery()
    avg_rate_result = await session.execute(
        select(func.avg(rate_subq.c.effective_rate))
    )
    avg_effective_rate = avg_rate_result.scalar()

    # Avg efficiency pct: for completed jobs with estimated_hours > 0,
    # compute sum(actual_hours) / estimated_hours * 100 per job, then average
    eff_subq = (
        select(
            WorkOrder.id,
            (func.sum(TimeLog.hours) / WorkOrder.estimated_hours * 100).label(
                "efficiency_pct"
            ),
        )
        .join(TimeLog, TimeLog.work_order_id == WorkOrder.id)
        .where(
            WorkOrder.organization_id == org_id,
            WorkOrder.completion_date.is_not(None),
            WorkOrder.estimated_hours > 0,
        )
        .group_by(WorkOrder.id, WorkOrder.estimated_hours)
    )
    if start_date:
        eff_subq = eff_subq.where(
            func.date(WorkOrder.completion_date) >= start_date
        )
    if end_date:
        eff_subq = eff_subq.where(
            func.date(WorkOrder.completion_date) <= end_date
        )
    eff_subq = eff_subq.subquery()
    avg_eff_result = await session.execute(
        select(func.avg(eff_subq.c.efficiency_pct))
    )
    avg_efficiency_pct = avg_eff_result.scalar()

    return AnalyticsSummaryResponse(
        total_hours=total_hours,
        avg_effective_rate=(
            round(Decimal(str(avg_effective_rate)), 2)
            if avg_effective_rate is not None
            else None
        ),
        avg_efficiency_pct=(
            round(Decimal(str(avg_efficiency_pct)), 2)
            if avg_efficiency_pct is not None
            else None
        ),
        total_jobs_completed=total_jobs_completed,
    )


@router.get("/efficiency", response_model=PhaseEfficiencyResponse)
async def get_efficiency(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_manager(user)
    org_id = user.organization_id

    phase_map = {
        Phase.DESIGN: DesignDetails,
        Phase.PRODUCTION: ProductionDetails,
        Phase.INSTALL: InstallDetails,
    }

    items: list[PhaseEfficiencyItem] = []

    for phase, detail_model in phase_map.items():
        # Actual hours from TimeLog for this phase
        actual_q = select(func.avg(TimeLog.hours)).where(
            TimeLog.organization_id == org_id,
            TimeLog.phase == phase,
            TimeLog.work_order_id.is_not(None),
        )
        if start_date:
            actual_q = actual_q.where(TimeLog.log_date >= start_date)
        if end_date:
            actual_q = actual_q.where(TimeLog.log_date <= end_date)
        avg_actual = (await session.execute(actual_q)).scalar()

        # Estimated hours from the detail model
        est_q = select(func.avg(detail_model.estimated_hours)).where(
            detail_model.organization_id == org_id,
            detail_model.estimated_hours.is_not(None),
            detail_model.estimated_hours > 0,
        )
        avg_estimated = (await session.execute(est_q)).scalar()

        if avg_actual is not None and avg_estimated is not None:
            avg_actual_dec = Decimal(str(avg_actual))
            avg_estimated_dec = Decimal(str(avg_estimated))
            efficiency = (
                round(avg_actual_dec / avg_estimated_dec * 100, 2)
                if avg_estimated_dec > 0
                else None
            )
            items.append(
                PhaseEfficiencyItem(
                    phase=phase.value,
                    avg_actual_hours=round(avg_actual_dec, 2),
                    avg_estimated_hours=round(avg_estimated_dec, 2),
                    efficiency_pct=efficiency,
                )
            )

    return PhaseEfficiencyResponse(items=items)


@router.get("/roi-trend", response_model=RoiTrendResponse)
async def get_roi_trend(
    granularity: str = Query("monthly", pattern="^(weekly|monthly)$"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_manager(user)
    org_id = user.organization_id

    # Get org hourly_cost
    org_result = await session.execute(
        select(Organization.hourly_cost).where(Organization.id == org_id)
    )
    hourly_cost = org_result.scalar()

    trunc_unit = "week" if granularity == "weekly" else "month"
    period_col = func.date_trunc(trunc_unit, WorkOrder.completion_date).label("period")

    q = (
        select(
            period_col,
            func.sum(WorkOrder.job_value).label("total_value"),
            func.sum(TimeLog.hours).label("total_hours"),
        )
        .join(TimeLog, TimeLog.work_order_id == WorkOrder.id)
        .where(
            WorkOrder.organization_id == org_id,
            WorkOrder.completion_date.is_not(None),
        )
        .group_by(period_col)
        .order_by(period_col)
    )
    if start_date:
        q = q.where(func.date(WorkOrder.completion_date) >= start_date)
    if end_date:
        q = q.where(func.date(WorkOrder.completion_date) <= end_date)

    result = await session.execute(q)
    rows = result.all()

    items: list[RoiTrendItem] = []
    for row in rows:
        period_str = row.period.strftime("%Y-%m-%d") if row.period else ""
        total_value = Decimal(str(row.total_value)) / 100 if row.total_value else None
        total_hrs = Decimal(str(row.total_hours)) if row.total_hours else None

        effective_rate = None
        roi_pct = None
        if total_value and total_hrs and total_hrs > 0:
            effective_rate = round(total_value / total_hrs, 2)
            if hourly_cost and hourly_cost > 0:
                roi_pct = round(
                    (effective_rate - hourly_cost) / hourly_cost * 100, 2
                )

        items.append(
            RoiTrendItem(
                period=period_str,
                effective_rate=effective_rate,
                roi_pct=roi_pct,
            )
        )

    return RoiTrendResponse(items=items)


@router.get("/jobs-ranked", response_model=JobsRankedResponse)
async def get_jobs_ranked(
    sort_by: str = Query("effective_rate", pattern="^(effective_rate|efficiency)$"),
    limit: int = Query(20, ge=1, le=100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_manager(user)
    org_id = user.organization_id

    effective_rate_col = case(
        (
            func.sum(TimeLog.hours) > 0,
            WorkOrder.job_value / 100.0 / func.sum(TimeLog.hours),
        ),
        else_=None,
    ).label("effective_rate")

    efficiency_col = case(
        (
            (func.sum(TimeLog.hours) > 0) & (WorkOrder.estimated_hours > 0),
            func.sum(TimeLog.hours) / WorkOrder.estimated_hours * 100,
        ),
        else_=None,
    ).label("efficiency_pct")

    q = (
        select(
            WorkOrder.id,
            WorkOrder.job_number,
            WorkOrder.job_value,
            func.sum(TimeLog.hours).label("total_hours"),
            WorkOrder.estimated_hours,
            effective_rate_col,
            efficiency_col,
        )
        .join(TimeLog, TimeLog.work_order_id == WorkOrder.id)
        .where(
            WorkOrder.organization_id == org_id,
            WorkOrder.completion_date.is_not(None),
        )
        .group_by(
            WorkOrder.id,
            WorkOrder.job_number,
            WorkOrder.job_value,
            WorkOrder.estimated_hours,
        )
        .having(func.sum(TimeLog.hours) > 0)
    )
    if start_date:
        q = q.where(func.date(WorkOrder.completion_date) >= start_date)
    if end_date:
        q = q.where(func.date(WorkOrder.completion_date) <= end_date)

    if sort_by == "effective_rate":
        q = q.order_by(effective_rate_col.desc().nulls_last())
    else:
        q = q.order_by(efficiency_col.desc().nulls_last())

    q = q.limit(limit)

    result = await session.execute(q)
    rows = result.all()

    items = [
        JobRankedItem(
            work_order_id=row.id,
            job_number=row.job_number,
            job_value=row.job_value,
            total_hours=Decimal(str(row.total_hours)),
            estimated_hours=(
                Decimal(str(row.estimated_hours)) if row.estimated_hours else None
            ),
            effective_rate=(
                round(Decimal(str(row.effective_rate)), 2)
                if row.effective_rate is not None
                else None
            ),
            efficiency_pct=(
                round(Decimal(str(row.efficiency_pct)), 2)
                if row.efficiency_pct is not None
                else None
            ),
        )
        for row in rows
    ]

    return JobsRankedResponse(items=items)


@router.get("/hours-by-member", response_model=HoursByMemberResponse)
async def get_hours_by_member(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _require_manager(user)
    org_id = user.organization_id

    # Get total hours per user
    totals_q = (
        select(
            TimeLog.user_id,
            User.full_name,
            User.email,
            func.sum(TimeLog.hours).label("total_hours"),
        )
        .join(User, User.id == TimeLog.user_id)
        .where(TimeLog.organization_id == org_id)
        .group_by(TimeLog.user_id, User.full_name, User.email)
    )
    if start_date:
        totals_q = totals_q.where(TimeLog.log_date >= start_date)
    if end_date:
        totals_q = totals_q.where(TimeLog.log_date <= end_date)

    totals_result = await session.execute(totals_q)
    totals_rows = totals_result.all()

    if not totals_rows:
        return HoursByMemberResponse(items=[])

    user_ids = [row.user_id for row in totals_rows]

    # Get phase breakdown per user
    breakdown_q = (
        select(
            TimeLog.user_id,
            TimeLog.phase,
            func.sum(TimeLog.hours).label("hours"),
        )
        .where(
            TimeLog.organization_id == org_id,
            TimeLog.user_id.in_(user_ids),
            TimeLog.phase.is_not(None),
        )
        .group_by(TimeLog.user_id, TimeLog.phase)
    )
    if start_date:
        breakdown_q = breakdown_q.where(TimeLog.log_date >= start_date)
    if end_date:
        breakdown_q = breakdown_q.where(TimeLog.log_date <= end_date)

    breakdown_result = await session.execute(breakdown_q)
    breakdown_rows = breakdown_result.all()

    # Build phase breakdown dict per user
    phase_map: dict[str, dict[str, Decimal]] = {}
    for row in breakdown_rows:
        uid = str(row.user_id)
        if uid not in phase_map:
            phase_map[uid] = {}
        phase_name = row.phase.value if row.phase else "other"
        phase_map[uid][phase_name] = Decimal(str(row.hours))

    items = [
        MemberHoursItem(
            user_id=row.user_id,
            full_name=row.full_name,
            email=row.email,
            total_hours=Decimal(str(row.total_hours)),
            phase_breakdown=phase_map.get(str(row.user_id), {}),
        )
        for row in totals_rows
    ]

    return HoursByMemberResponse(items=items)
