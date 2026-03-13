import uuid
from decimal import Decimal

from pydantic import BaseModel


class AnalyticsSummaryResponse(BaseModel):
    total_hours: Decimal
    avg_effective_rate: Decimal | None
    avg_efficiency_pct: Decimal | None
    total_jobs_completed: int


class PhaseEfficiencyItem(BaseModel):
    phase: str
    avg_actual_hours: Decimal
    avg_estimated_hours: Decimal
    efficiency_pct: Decimal | None


class PhaseEfficiencyResponse(BaseModel):
    items: list[PhaseEfficiencyItem]


class RoiTrendItem(BaseModel):
    period: str
    effective_rate: Decimal | None
    roi_pct: Decimal | None


class RoiTrendResponse(BaseModel):
    items: list[RoiTrendItem]


class JobRankedItem(BaseModel):
    work_order_id: uuid.UUID
    job_number: str
    job_value: int
    total_hours: Decimal
    estimated_hours: Decimal | None
    effective_rate: Decimal | None
    efficiency_pct: Decimal | None


class JobsRankedResponse(BaseModel):
    items: list[JobRankedItem]


class MemberHoursItem(BaseModel):
    user_id: uuid.UUID
    full_name: str | None
    email: str
    total_hours: Decimal
    phase_breakdown: dict[str, Decimal]


class HoursByMemberResponse(BaseModel):
    items: list[MemberHoursItem]
