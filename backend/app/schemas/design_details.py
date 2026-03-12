from decimal import Decimal

from pydantic import BaseModel


class DesignDetailsCreate(BaseModel):
    proofing_data: dict | None = None


class DesignDetailsResponse(BaseModel):
    design_hours: Decimal | None = None
    design_version_count: int = 0
    revision_count: int = 0
    proofing_data: dict | None = None

    model_config = {"from_attributes": True}
