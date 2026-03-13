import uuid

from pydantic import BaseModel


class ProductionDetailsCreate(BaseModel):
    printer_id: uuid.UUID | None = None
    laminator_id: uuid.UUID | None = None
    plotter_id: uuid.UUID | None = None
    print_media_brand_type: str | None = None
    laminate_brand_type: str | None = None
    window_perf_details: dict | None = None


class ProductionDetailsUpdate(BaseModel):
    printer_id: uuid.UUID | None = None
    laminator_id: uuid.UUID | None = None
    plotter_id: uuid.UUID | None = None
    print_media_brand_type: str | None = None
    laminate_brand_type: str | None = None
    window_perf_details: dict | None = None


class ProductionDetailsResponse(BaseModel):
    printer_id: uuid.UUID | None = None
    laminator_id: uuid.UUID | None = None
    plotter_id: uuid.UUID | None = None
    print_media_brand_type: str | None = None
    print_media_width: str | None = None
    laminate_brand_type: str | None = None
    laminate_width: str | None = None
    window_perf_details: dict | None = None

    model_config = {"from_attributes": True}
