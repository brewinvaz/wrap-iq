import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.estimate_defaults import EstimateDefaults


def extract_vehicle_type(work_order_vehicles) -> str | None:
    """Return shared vehicle_type if all vehicles match, else None."""
    if not work_order_vehicles:
        return None
    types = set()
    for wov in work_order_vehicles:
        vt = wov.vehicle.vehicle_type
        types.add(vt.value if hasattr(vt, "value") else vt)
    return types.pop() if len(types) == 1 else None


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

    def _enum_val(v):
        """Extract string value from enum or return string as-is."""
        return v.value if hasattr(v, "value") else v

    for rule in rules:
        # Check job_type match
        if rule.job_type is not None and (
            job_type is None or _enum_val(rule.job_type) != job_type
        ):
            continue

        # Check wrap_coverage match
        if rule.wrap_coverage is not None and (
            wrap_coverage is None or _enum_val(rule.wrap_coverage) != wrap_coverage
        ):
            continue

        # Check vehicle_type match
        if rule.vehicle_type is not None and (
            vehicle_type is None or _enum_val(rule.vehicle_type) != vehicle_type
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
