import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
MAX_FILE_SIZE_MB = 10


class RenderCreate(BaseModel):
    design_name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    vehicle_photo_key: str
    wrap_design_key: str
    work_order_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    vehicle_id: uuid.UUID | None = None


class RenderRegenerate(BaseModel):
    description: str | None = None


class RenderResponse(BaseModel):
    id: uuid.UUID
    design_name: str
    description: str | None = None
    status: str
    vehicle_photo_url: str
    wrap_design_url: str
    result_image_url: str | None = None
    share_token: str | None = None
    error_message: str | None = None
    work_order_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    vehicle_id: uuid.UUID | None = None
    created_by: uuid.UUID
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class RenderListResponse(BaseModel):
    items: list[RenderResponse]
    total: int


class SharedRenderResponse(BaseModel):
    design_name: str
    result_image_url: str
    created_at: datetime


class ShareResponse(BaseModel):
    share_url: str


class FileInfo(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str
    size_bytes: int = Field(gt=0)

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if v not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Content type not allowed: {v}")
        return v

    @field_validator("size_bytes")
    @classmethod
    def validate_size(cls, v: int) -> int:
        max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
        if v > max_bytes:
            raise ValueError(f"File too large: max {MAX_FILE_SIZE_MB}MB")
        return v


class RenderUploadRequest(BaseModel):
    files: list[FileInfo] = Field(min_length=1, max_length=2)


class UploadInfo(BaseModel):
    r2_key: str
    upload_url: str


class RenderUploadResponse(BaseModel):
    uploads: list[UploadInfo]
