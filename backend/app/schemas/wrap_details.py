from pydantic import BaseModel

from app.models.wrap_details import (
    BumperCoverage,
    CoverageLevel,
    WindowCoverage,
    WrapCoverage,
)


class WrapDetailsCreate(BaseModel):
    wrap_coverage: WrapCoverage | None = None
    roof_coverage: CoverageLevel | None = None
    door_handles: CoverageLevel | None = None
    window_coverage: WindowCoverage | None = None
    bumper_coverage: BumperCoverage | None = None
    misc_items: list[str] | None = None
    special_wrap_instructions: str | None = None


class WrapDetailsResponse(WrapDetailsCreate):
    model_config = {"from_attributes": True}
