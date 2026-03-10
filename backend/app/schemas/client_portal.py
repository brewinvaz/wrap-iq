import uuid
from datetime import datetime

from pydantic import BaseModel


class StatusTimelineEntry(BaseModel):
    phase: str
    label: str
    completed: bool
    completed_at: datetime | None = None


class PortalProjectSummary(BaseModel):
    id: uuid.UUID
    job_number: str
    status: str
    vehicle_summary: str
    date_in: datetime | None = None
    estimated_completion: datetime | None = None
    progress_pct: int

    model_config = {"from_attributes": True}


class PortalProjectDetail(PortalProjectSummary):
    status_timeline: list[StatusTimelineEntry]
    notes: str | None = None


class PortalProjectListResponse(BaseModel):
    items: list[PortalProjectSummary]
