import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.vehicle import VehicleType
from app.models.work_order import JobType

# ── Admin invite schemas ─────────────────────────────────────────────


class ClientInviteRequest(BaseModel):
    email: EmailStr


class ClientInviteResponse(BaseModel):
    id: uuid.UUID
    email: str
    token: str
    invited_by: uuid.UUID
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientInviteListResponse(BaseModel):
    items: list[ClientInviteResponse]
    total: int


# ── Onboarding form schemas ─────────────────────────────────────────


class OnboardingOrgInfo(BaseModel):
    """Returned when client validates their invite token."""

    organization_name: str


class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str


class UploadUrlResponse(BaseModel):
    upload_url: str
    r2_key: str


class FileKeyEntry(BaseModel):
    r2_key: str
    filename: str
    content_type: str
    size_bytes: int


class VehicleInput(BaseModel):
    vin: str | None = None
    year: int | None = None
    make: str | None = None
    model: str | None = None
    vehicle_type: VehicleType | None = None


class OnboardingSubmission(BaseModel):
    first_name: str
    last_name: str
    phone: str | None = None
    company_name: str | None = None
    address: str | None = None
    vehicle: VehicleInput
    job_type: JobType = JobType.personal
    project_description: str | None = None
    referral_source: str | None = None
    file_keys: list[FileKeyEntry] = []


class OnboardingResult(BaseModel):
    message: str
    work_order_id: uuid.UUID
    job_number: str
