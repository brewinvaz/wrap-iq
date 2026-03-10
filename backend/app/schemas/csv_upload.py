import uuid

from pydantic import BaseModel


class RowErrorResponse(BaseModel):
    row: int
    field: str
    message: str


class UploadResultResponse(BaseModel):
    total_rows: int
    successful: int
    failed: int
    errors: list[RowErrorResponse]
    created_ids: list[uuid.UUID]


class CSVPreviewResponse(BaseModel):
    headers: list[str]
    sample_rows: list[dict[str, str]]
    total_rows: int
    validation_errors: list[RowErrorResponse]
