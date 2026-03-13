import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.estimate_defaults import EstimateDefaults


async def find_matching_estimates(
    session: AsyncSession,
    org_id: uuid.UUID,
    job_type: str | None = None,
    vehicle_count: int | None = None,
    wrap_coverage: str | None = None,
    vehicle_type: str | None = None,
) -> EstimateDefaults | None:
    """Find the highest-priority active estimate default matching the given criteria.

    For each rule, all non-null keys must match. If a rule key is null, it is
    treated as a wildcard (matches anything). Vehicle count is matched against
    the min/max range when those bounds are set.
    """
    query = (
        select(EstimateDefaults)
        .where(
            EstimateDefaults.organization_id == org_id,
            EstimateDefaults.is_active.is_(True),
        )
        .order_by(EstimateDefaults.priority.desc())
    )

    result = await session.execute(query)
    rules = result.scalars().all()

    for rule in rules:
        # Check job_type match
        if rule.job_type is not None and (
            job_type is None or rule.job_type.value != job_type
        ):
            continue

        # Check wrap_coverage match
        if rule.wrap_coverage is not None and (
            wrap_coverage is None or rule.wrap_coverage.value != wrap_coverage
        ):
            continue

        # Check vehicle_type match
        if rule.vehicle_type is not None and (
            vehicle_type is None or rule.vehicle_type.value != vehicle_type
        ):
            continue

        # Check vehicle_count range
        if rule.vehicle_count_min is not None and (
            vehicle_count is None or vehicle_count < rule.vehicle_count_min
        ):
            continue
        if rule.vehicle_count_max is not None and (
            vehicle_count is None or vehicle_count > rule.vehicle_count_max
        ):
            continue

        return rule

    return None
