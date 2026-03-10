import enum
import uuid

from pydantic import BaseModel, Field


class Severity(enum.StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DiscrepancyCheckRequest(BaseModel):
    vehicle_id: uuid.UUID


class Discrepancy(BaseModel):
    field: str
    expected: str | None = None
    detected: str | None = None
    severity: Severity


class DiscrepancyCheckResponse(BaseModel):
    discrepancies: list[Discrepancy] = []
    match_confidence: float = Field(ge=0, le=1)
    image_analysis_summary: str = ""
