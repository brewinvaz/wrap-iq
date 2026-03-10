from pydantic import BaseModel, Field

from app.models.vehicle import VehicleType


class DetectionSuggestion(BaseModel):
    year: int | None = None
    make: str | None = None
    model: str | None = None
    confidence: float = Field(ge=0, le=1)


class VehicleDetectionResponse(BaseModel):
    year: int | None = None
    make: str | None = None
    model: str | None = None
    vehicle_type: VehicleType | None = None
    color: str | None = None
    confidence: float = Field(ge=0, le=1)
    suggestions: list[DetectionSuggestion] = []
