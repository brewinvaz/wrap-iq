"""Schemas for work order photo endpoints."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PhotoUploadUrlRequest(BaseModel):
    filename: str
    content_type: str


class PhotoUploadUrlResponse(BaseModel):
    upload_url: str
    r2_key: str


class PhotoRegisterFile(BaseModel):
    r2_key: str
    filename: str
    content_type: str
    size_bytes: int


class PhotoRegisterRequest(BaseModel):
    files: list[PhotoRegisterFile] = Field(min_length=1, max_length=5)


class PhotoUpdateRequest(BaseModel):
    photo_type: Literal["before", "after"] | None = None
    caption: str | None = Field(default=None, max_length=500)


class PhotoResponse(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    photo_type: str | None
    caption: str | None
    url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PhotoListResponse(BaseModel):
    photos: list[PhotoResponse]
