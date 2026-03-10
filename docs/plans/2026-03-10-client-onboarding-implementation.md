# Client Self-Service Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin-invited client onboarding with Cloudflare R2 file uploads that auto-creates User + Vehicle + WorkOrder in LEAD status.

**Architecture:** New models (ClientInvite, UserProfile, FileUpload), R2 service for presigned uploads, onboarding endpoints authenticated by invite token (no JWT), submission creates all records in one transaction then sends magic link for portal access.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), boto3 (S3-compatible for R2), PyJWT, pytest

---

## Task 1: UserProfile Model

**Goal:** Create UserProfile model (1:1 with User) for client contact info.

**Files:**
- Create: `backend/app/models/user_profile.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_models/test_user_profile.py`

### Create `backend/app/models/user_profile.py`

```python
import uuid

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), unique=True, index=True
    )
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", lazy="selectin")
```

### Update `backend/app/models/__init__.py`

Add import:
```python
from app.models.user_profile import UserProfile
```

Add to `__all__`:
```python
"UserProfile",
```

### Update `backend/tests/conftest.py`

Add `"user_profiles"` to `_DROP_TABLES` list (before `"users"`).

### Test `backend/tests/test_models/test_user_profile.py`

```python
import uuid

import pytest

from app.auth.passwords import hash_password
from app.models.user import Role, User
from app.models.user_profile import UserProfile


async def test_create_user_profile(db_session):
    user = User(
        id=uuid.uuid4(),
        organization_id=None,
        email="client@test.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(user)
    await db_session.flush()

    profile = UserProfile(
        id=uuid.uuid4(),
        user_id=user.id,
        first_name="Jane",
        last_name="Doe",
        phone="555-1234",
        company_name="Doe Fleet",
        address="123 Main St",
    )
    db_session.add(profile)
    await db_session.flush()

    assert profile.first_name == "Jane"
    assert profile.user_id == user.id


async def test_user_profile_unique_user_id(db_session):
    user = User(
        id=uuid.uuid4(),
        organization_id=None,
        email="client2@test.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(user)
    await db_session.flush()

    p1 = UserProfile(id=uuid.uuid4(), user_id=user.id, first_name="A")
    db_session.add(p1)
    await db_session.flush()

    p2 = UserProfile(id=uuid.uuid4(), user_id=user.id, first_name="B")
    db_session.add(p2)
    with pytest.raises(Exception):
        await db_session.flush()
```

### Run & verify

```bash
cd backend && uv run ruff check app/models/user_profile.py tests/test_models/test_user_profile.py && uv run ruff format app/models/user_profile.py tests/test_models/test_user_profile.py
cd backend && uv run pytest tests/test_models/test_user_profile.py -v
```

### Commit

```bash
git add backend/app/models/user_profile.py backend/app/models/__init__.py backend/tests/conftest.py backend/tests/test_models/test_user_profile.py
git commit -m "$(cat <<'EOF'
feat(models): add UserProfile model for client contact info

1:1 with User, stores first_name, last_name, phone, company_name, address.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: ClientInvite Model

**Goal:** Create ClientInvite model for admin-to-client invitations.

**Files:**
- Create: `backend/app/models/client_invite.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_models/test_client_invite.py`

### Create `backend/app/models/client_invite.py`

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class ClientInvite(Base, TenantMixin, TimestampMixin):
    __tablename__ = "client_invites"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    invited_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    inviter = relationship("User", lazy="selectin")
```

### Update `backend/app/models/__init__.py`

Add import:
```python
from app.models.client_invite import ClientInvite
```

Add to `__all__`:
```python
"ClientInvite",
```

### Update `backend/tests/conftest.py`

Add `"client_invites"` to `_DROP_TABLES` list (before `"users"`).

### Test `backend/tests/test_models/test_client_invite.py`

```python
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from app.models.client_invite import ClientInvite
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


async def test_create_client_invite(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(admin)
    await db_session.flush()

    invite = ClientInvite(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="client@example.com",
        token=secrets.token_urlsafe(32),
        invited_by=admin.id,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db_session.add(invite)
    await db_session.flush()

    assert invite.email == "client@example.com"
    assert invite.accepted_at is None
    assert invite.organization_id == org.id
```

### Run & verify

```bash
cd backend && uv run ruff check app/models/client_invite.py tests/test_models/test_client_invite.py && uv run ruff format app/models/client_invite.py tests/test_models/test_client_invite.py
cd backend && uv run pytest tests/test_models/test_client_invite.py -v
```

### Commit

```bash
git add backend/app/models/client_invite.py backend/app/models/__init__.py backend/tests/conftest.py backend/tests/test_models/test_client_invite.py
git commit -m "$(cat <<'EOF'
feat(models): add ClientInvite model for admin-to-client invitations

Org-scoped invite with token, expiry, and accepted_at tracking.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: FileUpload Model

**Goal:** Create FileUpload model for tracking R2 uploads.

**Files:**
- Create: `backend/app/models/file_upload.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/tests/conftest.py`
- Test: `backend/tests/test_models/test_file_upload.py`

### Create `backend/app/models/file_upload.py`

```python
import uuid

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class FileUpload(Base, TenantMixin, TimestampMixin):
    __tablename__ = "file_uploads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), nullable=True, index=True
    )
    r2_key: Mapped[str] = mapped_column(String(1024), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)

    uploader = relationship("User", lazy="selectin")
    work_order = relationship("WorkOrder", lazy="selectin")
```

### Update `backend/app/models/__init__.py`

Add import:
```python
from app.models.file_upload import FileUpload
```

Add to `__all__`:
```python
"FileUpload",
```

### Update `backend/tests/conftest.py`

Add `"file_uploads"` to `_DROP_TABLES` list (before `"users"`).

### Test `backend/tests/test_models/test_file_upload.py`

```python
import uuid

from app.models.file_upload import FileUpload
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


async def test_create_file_upload(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="u@test.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(user)
    await db_session.flush()

    upload = FileUpload(
        id=uuid.uuid4(),
        organization_id=org.id,
        uploaded_by=user.id,
        work_order_id=None,
        r2_key=f"{org.id}/onboarding/test/abc_photo.jpg",
        filename="photo.jpg",
        content_type="image/jpeg",
        size_bytes=102400,
    )
    db_session.add(upload)
    await db_session.flush()

    assert upload.r2_key.startswith(str(org.id))
    assert upload.size_bytes == 102400
    assert upload.content_type == "image/jpeg"
```

### Run & verify

```bash
cd backend && uv run ruff check app/models/file_upload.py tests/test_models/test_file_upload.py && uv run ruff format app/models/file_upload.py tests/test_models/test_file_upload.py
cd backend && uv run pytest tests/test_models/test_file_upload.py -v
```

### Commit

```bash
git add backend/app/models/file_upload.py backend/app/models/__init__.py backend/tests/conftest.py backend/tests/test_models/test_file_upload.py
git commit -m "$(cat <<'EOF'
feat(models): add FileUpload model for R2 file tracking

Org-scoped file metadata with r2_key, filename, content_type, size_bytes.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: R2 Service + Config

**Goal:** Add R2 config settings and service for presigned URL generation.

**Files:**
- Modify: `backend/app/config.py`
- Create: `backend/app/services/r2.py`
- Test: `backend/tests/test_services/test_r2_service.py`

### Update `backend/app/config.py`

Add these fields to the `Settings` class (after the Email section):

```python
    # Cloudflare R2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "wrapiq-uploads"
    r2_public_url: str = ""
```

### Create `backend/app/services/r2.py`

```python
import uuid

import boto3
from botocore.config import Config

from app.config import settings

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
MAX_FILE_SIZE_MB = 10
MAX_FILES_PER_SUBMISSION = 5


def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def generate_object_key(org_id: uuid.UUID, filename: str) -> str:
    safe_filename = filename.replace("/", "_").replace("\\", "_")
    unique = uuid.uuid4().hex[:8]
    return f"{org_id}/onboarding/{unique}_{safe_filename}"


def generate_upload_url(key: str, content_type: str, expires_in: int = 900) -> str:
    """Generate a presigned PUT URL for uploading to R2. Expires in 15 minutes."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Content type not allowed: {content_type}")

    client = _get_client()
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url


def generate_download_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL for downloading from R2. Expires in 1 hour."""
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": key,
        },
        ExpiresIn=expires_in,
    )


def delete_object(key: str) -> None:
    """Delete an object from R2."""
    client = _get_client()
    client.delete_object(Bucket=settings.r2_bucket_name, Key=key)


def validate_file_keys(
    org_id: uuid.UUID,
    file_keys: list[dict],
) -> None:
    """Validate file keys belong to the org namespace and meet constraints."""
    if len(file_keys) > MAX_FILES_PER_SUBMISSION:
        raise ValueError(f"Maximum {MAX_FILES_PER_SUBMISSION} files per submission")

    org_prefix = str(org_id) + "/"
    for fk in file_keys:
        if not fk["r2_key"].startswith(org_prefix):
            raise ValueError("Invalid file key: does not belong to organization")
        if fk["content_type"] not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Invalid content type: {fk['content_type']}")
        if fk["size_bytes"] > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise ValueError(f"File too large: max {MAX_FILE_SIZE_MB}MB")
```

### Add `boto3` dependency

```bash
cd backend && uv add boto3
```

### Test `backend/tests/test_services/test_r2_service.py`

```python
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.r2 import (
    ALLOWED_CONTENT_TYPES,
    MAX_FILES_PER_SUBMISSION,
    generate_object_key,
    generate_upload_url,
    validate_file_keys,
)


def test_generate_object_key():
    org_id = uuid.uuid4()
    key = generate_object_key(org_id, "photo.jpg")
    assert key.startswith(f"{org_id}/onboarding/")
    assert key.endswith("_photo.jpg")


def test_generate_object_key_sanitizes_path():
    org_id = uuid.uuid4()
    key = generate_object_key(org_id, "../../etc/passwd")
    assert "/" not in key.split("/onboarding/")[1].rsplit("_", 1)[0]


def test_validate_file_keys_valid():
    org_id = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{org_id}/onboarding/abc_photo.jpg",
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
        }
    ]
    validate_file_keys(org_id, keys)  # Should not raise


def test_validate_file_keys_wrong_org():
    org_id = uuid.uuid4()
    other_org = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{other_org}/onboarding/abc_photo.jpg",
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
        }
    ]
    with pytest.raises(ValueError, match="does not belong"):
        validate_file_keys(org_id, keys)


def test_validate_file_keys_too_many():
    org_id = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{org_id}/onboarding/{i}_photo.jpg",
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
        }
        for i in range(MAX_FILES_PER_SUBMISSION + 1)
    ]
    with pytest.raises(ValueError, match="Maximum"):
        validate_file_keys(org_id, keys)


def test_validate_file_keys_bad_content_type():
    org_id = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{org_id}/onboarding/abc_file.exe",
            "filename": "file.exe",
            "content_type": "application/x-executable",
            "size_bytes": 1024,
        }
    ]
    with pytest.raises(ValueError, match="Invalid content type"):
        validate_file_keys(org_id, keys)


def test_validate_file_keys_too_large():
    org_id = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{org_id}/onboarding/abc_big.jpg",
            "filename": "big.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 11 * 1024 * 1024,  # 11MB
        }
    ]
    with pytest.raises(ValueError, match="File too large"):
        validate_file_keys(org_id, keys)


@patch("app.services.r2._get_client")
def test_generate_upload_url(mock_get_client):
    mock_client = MagicMock()
    mock_client.generate_presigned_url.return_value = "https://r2.example.com/signed"
    mock_get_client.return_value = mock_client

    url = generate_upload_url("key/file.jpg", "image/jpeg")
    assert url == "https://r2.example.com/signed"
    mock_client.generate_presigned_url.assert_called_once()


def test_generate_upload_url_rejects_bad_type():
    with pytest.raises(ValueError, match="Content type not allowed"):
        generate_upload_url("key/file.exe", "application/x-executable")
```

### Run & verify

```bash
cd backend && uv run ruff check app/services/r2.py app/config.py tests/test_services/test_r2_service.py && uv run ruff format app/services/r2.py app/config.py tests/test_services/test_r2_service.py
cd backend && uv run pytest tests/test_services/test_r2_service.py -v
```

### Commit

```bash
git add backend/app/config.py backend/app/services/r2.py backend/tests/test_services/test_r2_service.py backend/pyproject.toml backend/uv.lock
git commit -m "$(cat <<'EOF'
feat(r2): add Cloudflare R2 service for presigned file uploads

S3-compatible presigned URL generation, file key validation,
and config settings for R2 integration.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Onboarding Schemas

**Goal:** Pydantic schemas for invite, onboarding form, and upload endpoints.

**Files:**
- Create: `backend/app/schemas/onboarding.py`

### Create `backend/app/schemas/onboarding.py`

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import Role
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
    job_type: JobType = JobType.PERSONAL
    project_description: str | None = None
    referral_source: str | None = None
    file_keys: list[FileKeyEntry] = []


class OnboardingResult(BaseModel):
    message: str
    work_order_id: uuid.UUID
    job_number: str
```

### Run & verify

```bash
cd backend && uv run ruff check app/schemas/onboarding.py && uv run ruff format app/schemas/onboarding.py
cd backend && uv run python -c "from app.schemas.onboarding import *; print('All schemas imported OK')"
```

### Commit

```bash
git add backend/app/schemas/onboarding.py
git commit -m "$(cat <<'EOF'
feat(schemas): add Pydantic schemas for client onboarding

Schemas for admin invite, onboarding form submission,
file upload URLs, and vehicle input.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Onboarding Service

**Goal:** Business logic for inviting clients, validating tokens, and processing onboarding submissions.

**Files:**
- Create: `backend/app/services/onboarding.py`
- Test: `backend/tests/test_services/test_onboarding_service.py`

### Create `backend/app/services/onboarding.py`

```python
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.models.client_invite import ClientInvite
from app.models.file_upload import FileUpload
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.user import Role, User
from app.models.user_profile import UserProfile
from app.models.vehicle import Vehicle
from app.models.work_order import JobType, Priority, WorkOrder, WorkOrderVehicle
from app.services.r2 import validate_file_keys


class OnboardingService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Admin: invite management ─────────────────────────────────────

    async def create_invite(
        self,
        organization_id: uuid.UUID,
        email: str,
        invited_by: uuid.UUID,
    ) -> ClientInvite:
        invite = ClientInvite(
            id=uuid.uuid4(),
            organization_id=organization_id,
            email=email,
            token=secrets.token_urlsafe(32),
            invited_by=invited_by,
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
        self.session.add(invite)
        await self.session.flush()
        return invite

    async def list_invites(
        self,
        organization_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ClientInvite], int]:
        query = (
            select(ClientInvite)
            .where(ClientInvite.organization_id == organization_id)
            .order_by(ClientInvite.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        count_query = (
            select(func.count())
            .select_from(ClientInvite)
            .where(ClientInvite.organization_id == organization_id)
        )
        result = await self.session.execute(query)
        invites = list(result.scalars().all())
        total = (await self.session.execute(count_query)).scalar_one()
        return invites, total

    # ── Client: token validation ─────────────────────────────────────

    async def validate_token(self, token: str) -> ClientInvite | None:
        """Return invite if token is valid, unexpired, and unused."""
        result = await self.session.execute(
            select(ClientInvite).where(
                ClientInvite.token == token,
                ClientInvite.accepted_at.is_(None),
                ClientInvite.expires_at > datetime.now(UTC),
            )
        )
        return result.scalar_one_or_none()

    async def get_org_for_invite(self, invite: ClientInvite) -> Organization:
        result = await self.session.execute(
            select(Organization).where(Organization.id == invite.organization_id)
        )
        return result.scalar_one()

    # ── Client: form submission ──────────────────────────────────────

    async def submit_onboarding(
        self,
        invite: ClientInvite,
        first_name: str,
        last_name: str,
        phone: str | None,
        company_name: str | None,
        address: str | None,
        vehicle_data: dict,
        job_type: JobType,
        project_description: str | None,
        referral_source: str | None,
        file_keys: list[dict],
    ) -> dict:
        org_id = invite.organization_id

        # Validate file keys
        if file_keys:
            validate_file_keys(org_id, file_keys)

        # 1. Find or create client User
        result = await self.session.execute(
            select(User).where(
                User.email == invite.email,
                User.organization_id == org_id,
            )
        )
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                id=uuid.uuid4(),
                organization_id=org_id,
                email=invite.email,
                password_hash=None,
                role=Role.CLIENT,
            )
            self.session.add(user)
            await self.session.flush()

        # 2. Create or update UserProfile
        result = await self.session.execute(
            select(UserProfile).where(UserProfile.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = UserProfile(
                id=uuid.uuid4(),
                user_id=user.id,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                company_name=company_name,
                address=address,
            )
            self.session.add(profile)
        else:
            profile.first_name = first_name
            profile.last_name = last_name
            profile.phone = phone
            profile.company_name = company_name
            profile.address = address
        await self.session.flush()

        # 3. Create Vehicle
        vehicle = Vehicle(
            id=uuid.uuid4(),
            organization_id=org_id,
            vin=vehicle_data.get("vin"),
            year=vehicle_data.get("year"),
            make=vehicle_data.get("make"),
            model=vehicle_data.get("model"),
            vehicle_type=vehicle_data.get("vehicle_type"),
        )
        self.session.add(vehicle)
        await self.session.flush()

        # 4. Find LEAD kanban stage for the org
        lead_stage = await self._get_lead_stage(org_id)

        # 5. Generate job number
        job_number = await self._generate_job_number(org_id)

        # 6. Create WorkOrder
        notes_parts = []
        if project_description:
            notes_parts.append(f"Project: {project_description}")
        if referral_source:
            notes_parts.append(f"Referral: {referral_source}")

        work_order = WorkOrder(
            id=uuid.uuid4(),
            organization_id=org_id,
            job_number=job_number,
            job_type=job_type,
            status_id=lead_stage.id,
            priority=Priority.MEDIUM,
            date_in=datetime.now(UTC),
            internal_notes="\n".join(notes_parts) if notes_parts else None,
        )
        self.session.add(work_order)
        await self.session.flush()

        # 7. Link vehicle to work order
        wov = WorkOrderVehicle(
            work_order_id=work_order.id,
            vehicle_id=vehicle.id,
        )
        self.session.add(wov)

        # 8. Create FileUpload records
        for fk in file_keys:
            upload = FileUpload(
                id=uuid.uuid4(),
                organization_id=org_id,
                uploaded_by=user.id,
                work_order_id=work_order.id,
                r2_key=fk["r2_key"],
                filename=fk["filename"],
                content_type=fk["content_type"],
                size_bytes=fk["size_bytes"],
            )
            self.session.add(upload)

        # 9. Mark invite as accepted
        invite.accepted_at = datetime.now(UTC)

        await self.session.flush()

        return {
            "work_order_id": work_order.id,
            "job_number": work_order.job_number,
            "user_id": user.id,
        }

    async def _get_lead_stage(self, org_id: uuid.UUID) -> KanbanStage:
        result = await self.session.execute(
            select(KanbanStage).where(
                KanbanStage.organization_id == org_id,
                KanbanStage.system_status == SystemStatus.LEAD,
                KanbanStage.is_active.is_(True),
            )
        )
        stage = result.scalar_one_or_none()
        if not stage:
            raise ValueError("No LEAD stage configured for this organization")
        return stage

    async def _generate_job_number(self, org_id: uuid.UUID) -> str:
        count_result = await self.session.execute(
            select(func.count())
            .select_from(WorkOrder)
            .where(WorkOrder.organization_id == org_id)
        )
        count = count_result.scalar_one()
        return f"WO-{count + 1:05d}"
```

### Test `backend/tests/test_services/test_onboarding_service.py`

```python
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.models.client_invite import ClientInvite
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User
from app.models.work_order import JobType
from app.services.onboarding import OnboardingService


@pytest.fixture
async def plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    return plan


@pytest.fixture
async def org(db_session, plan):
    org = Organization(id=uuid.uuid4(), name="Test Shop", slug="test-shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


@pytest.fixture
async def lead_stage(db_session, org):
    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Lead",
        system_status=SystemStatus.LEAD,
        position=0,
        is_default=True,
    )
    db_session.add(stage)
    await db_session.flush()
    return stage


@pytest.fixture
async def admin(db_session, org):
    user = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@shop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def service(db_session):
    return OnboardingService(db_session)


async def test_create_invite(db_session, org, admin, service):
    invite = await service.create_invite(org.id, "client@example.com", admin.id)
    assert invite.email == "client@example.com"
    assert invite.token is not None
    assert invite.accepted_at is None
    assert invite.organization_id == org.id


async def test_list_invites(db_session, org, admin, service):
    await service.create_invite(org.id, "a@example.com", admin.id)
    await service.create_invite(org.id, "b@example.com", admin.id)

    invites, total = await service.list_invites(org.id)
    assert total == 2
    assert len(invites) == 2


async def test_validate_token_valid(db_session, org, admin, service):
    invite = await service.create_invite(org.id, "c@example.com", admin.id)
    result = await service.validate_token(invite.token)
    assert result is not None
    assert result.id == invite.id


async def test_validate_token_expired(db_session, org, admin):
    invite = ClientInvite(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="expired@example.com",
        token="expired-token",
        invited_by=admin.id,
        expires_at=datetime.now(UTC) - timedelta(hours=1),
    )
    db_session.add(invite)
    await db_session.flush()

    service = OnboardingService(db_session)
    result = await service.validate_token("expired-token")
    assert result is None


async def test_validate_token_already_used(db_session, org, admin):
    invite = ClientInvite(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="used@example.com",
        token="used-token",
        invited_by=admin.id,
        expires_at=datetime.now(UTC) + timedelta(days=7),
        accepted_at=datetime.now(UTC),
    )
    db_session.add(invite)
    await db_session.flush()

    service = OnboardingService(db_session)
    result = await service.validate_token("used-token")
    assert result is None


async def test_submit_onboarding(db_session, org, admin, lead_stage, service):
    invite = await service.create_invite(org.id, "new-client@example.com", admin.id)

    result = await service.submit_onboarding(
        invite=invite,
        first_name="John",
        last_name="Smith",
        phone="555-9999",
        company_name="Smith Fleet",
        address="456 Oak Ave",
        vehicle_data={"year": 2024, "make": "Ford", "model": "Transit"},
        job_type=JobType.COMMERCIAL,
        project_description="Full wrap for fleet van",
        referral_source="Google",
        file_keys=[],
    )

    assert result["job_number"] == "WO-00001"
    assert result["work_order_id"] is not None
    assert result["user_id"] is not None

    # Invite should be marked accepted
    assert invite.accepted_at is not None


async def test_submit_onboarding_existing_user(db_session, org, admin, lead_stage, service):
    # Pre-create a client user
    existing = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="existing@example.com",
        password_hash=None,
        role=Role.CLIENT,
    )
    db_session.add(existing)
    await db_session.flush()

    invite = await service.create_invite(org.id, "existing@example.com", admin.id)

    result = await service.submit_onboarding(
        invite=invite,
        first_name="Existing",
        last_name="Client",
        phone=None,
        company_name=None,
        address=None,
        vehicle_data={"vin": "1HGBH41JXMN109186"},
        job_type=JobType.PERSONAL,
        project_description=None,
        referral_source=None,
        file_keys=[],
    )

    # Should reuse existing user
    assert result["user_id"] == existing.id


async def test_submit_onboarding_no_lead_stage(db_session, org, admin, service):
    # No lead stage seeded
    invite = await service.create_invite(org.id, "nolead@example.com", admin.id)

    with pytest.raises(ValueError, match="No LEAD stage"):
        await service.submit_onboarding(
            invite=invite,
            first_name="No",
            last_name="Lead",
            phone=None,
            company_name=None,
            address=None,
            vehicle_data={"year": 2024, "make": "Toyota", "model": "Camry"},
            job_type=JobType.PERSONAL,
            project_description=None,
            referral_source=None,
            file_keys=[],
        )


async def test_submit_onboarding_with_file_keys(db_session, org, admin, lead_stage, service):
    invite = await service.create_invite(org.id, "files@example.com", admin.id)

    file_keys = [
        {
            "r2_key": f"{org.id}/onboarding/abc_ref.jpg",
            "filename": "ref.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 2048,
        }
    ]

    result = await service.submit_onboarding(
        invite=invite,
        first_name="File",
        last_name="Client",
        phone=None,
        company_name=None,
        address=None,
        vehicle_data={"year": 2023, "make": "Honda", "model": "Civic"},
        job_type=JobType.PERSONAL,
        project_description=None,
        referral_source=None,
        file_keys=file_keys,
    )

    assert result["work_order_id"] is not None
```

### Run & verify

```bash
cd backend && uv run ruff check app/services/onboarding.py tests/test_services/test_onboarding_service.py && uv run ruff format app/services/onboarding.py tests/test_services/test_onboarding_service.py
cd backend && uv run pytest tests/test_services/test_onboarding_service.py -v
```

### Commit

```bash
git add backend/app/services/onboarding.py backend/tests/test_services/test_onboarding_service.py
git commit -m "$(cat <<'EOF'
feat(services): add OnboardingService for client invite and form submission

Invite creation, token validation, atomic onboarding submission that
creates User + UserProfile + Vehicle + WorkOrder + FileUpload records.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Admin Client Invite Routes

**Goal:** Add endpoints for admins to send and list client invites.

**Files:**
- Create: `backend/app/routers/client_invites.py`
- Modify: `backend/app/services/email.py`
- Test: `backend/tests/test_routers/test_client_invites.py`

### Create `backend/app/routers/client_invites.py`

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.auth.permissions import require_admin
from app.models.user import User
from app.schemas.onboarding import (
    ClientInviteListResponse,
    ClientInviteRequest,
    ClientInviteResponse,
)
from app.services.email import send_onboarding_invite_email
from app.services.onboarding import OnboardingService

router = APIRouter(prefix="/api/admin/client-invites", tags=["admin"])


@router.post("", response_model=ClientInviteResponse, status_code=201)
async def create_client_invite(
    body: ClientInviteRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Send an onboarding invite to a client."""
    service = OnboardingService(session)
    invite = await service.create_invite(
        organization_id=admin.organization_id,
        email=body.email,
        invited_by=admin.id,
    )
    await session.commit()
    await session.refresh(invite)

    await send_onboarding_invite_email(
        to_email=invite.email,
        token=invite.token,
        org_name=admin.organization.name,
    )

    return invite


@router.get("", response_model=ClientInviteListResponse)
async def list_client_invites(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List client invites for the admin's organization."""
    service = OnboardingService(session)
    invites, total = await service.list_invites(
        organization_id=admin.organization_id,
        limit=limit,
        offset=offset,
    )
    return {"items": invites, "total": total}
```

### Update `backend/app/services/email.py`

Add the onboarding invite email function:

```python
async def send_onboarding_invite_email(
    to_email: str, token: str, org_name: str
) -> None:
    onboarding_url = f"{settings.frontend_url}/onboard?token={token}"

    if not settings.resend_api_key:
        print(f"\n[DEV] Onboarding invite for {to_email}: {onboarding_url}\n")
        return

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.email_from,
            "to": [to_email],
            "subject": f"{org_name} - Start Your Project",
            "html": (
                f"<p>{org_name} has invited you to start a project.</p>"
                f"<p>Please fill out the onboarding form to get started:</p>"
                f'<p><a href="{onboarding_url}">Start Onboarding</a></p>'
                f"<p>This link expires in 7 days.</p>"
            ),
        }
    )
```

### Test `backend/tests/test_routers/test_client_invites.py`

```python
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.auth.jwt import create_access_token
from app.main import app
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


@pytest.fixture
async def seed_data(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Test Shop", slug="test-shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@testshop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(admin)
    await db_session.commit()

    return {"plan": plan, "org": org, "admin": admin}


@pytest.fixture
async def client(db_session, seed_data):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def auth_headers(user: User) -> dict:
    token = create_access_token(
        user_id=user.id,
        organization_id=user.organization_id,
        role=user.role.value,
    )
    return {"Authorization": f"Bearer {token}"}


async def test_create_client_invite(client, seed_data):
    headers = auth_headers(seed_data["admin"])
    resp = await client.post(
        "/api/admin/client-invites",
        headers=headers,
        json={"email": "newclient@example.com"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newclient@example.com"
    assert data["token"] is not None
    assert data["accepted_at"] is None


async def test_list_client_invites(client, seed_data):
    headers = auth_headers(seed_data["admin"])

    # Create two invites
    await client.post(
        "/api/admin/client-invites",
        headers=headers,
        json={"email": "a@example.com"},
    )
    await client.post(
        "/api/admin/client-invites",
        headers=headers,
        json={"email": "b@example.com"},
    )

    resp = await client.get("/api/admin/client-invites", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_non_admin_cannot_invite(client, seed_data, db_session):
    installer = User(
        id=uuid.uuid4(),
        organization_id=seed_data["org"].id,
        email="installer@testshop.com",
        password_hash="hashed",
        role=Role.INSTALLER,
    )
    db_session.add(installer)
    await db_session.commit()

    headers = auth_headers(installer)
    resp = await client.post(
        "/api/admin/client-invites",
        headers=headers,
        json={"email": "c@example.com"},
    )
    assert resp.status_code == 403
```

### Run & verify

```bash
cd backend && uv run ruff check app/routers/client_invites.py app/services/email.py tests/test_routers/test_client_invites.py && uv run ruff format app/routers/client_invites.py app/services/email.py tests/test_routers/test_client_invites.py
cd backend && uv run pytest tests/test_routers/test_client_invites.py -v
```

### Commit

```bash
git add backend/app/routers/client_invites.py backend/app/services/email.py backend/tests/test_routers/test_client_invites.py
git commit -m "$(cat <<'EOF'
feat(api): add admin client invite endpoints

POST/GET /api/admin/client-invites for sending and listing
onboarding invitations with branded email.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Onboarding Portal Routes

**Goal:** Public onboarding endpoints authenticated by invite token.

**Files:**
- Create: `backend/app/routers/onboarding.py`
- Test: `backend/tests/test_routers/test_onboarding_routes.py`

### Create `backend/app/routers/onboarding.py`

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_session
from app.schemas.onboarding import (
    OnboardingOrgInfo,
    OnboardingResult,
    OnboardingSubmission,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services.email import send_magic_link_email
from app.services.onboarding import OnboardingService
from app.services.r2 import generate_object_key, generate_upload_url
from app.services.vin import VinService

router = APIRouter(prefix="/api/portal/onboarding", tags=["onboarding"])


async def _get_valid_invite(token: str, session: AsyncSession):
    """Helper to validate invite token and return invite or raise."""
    service = OnboardingService(session)
    invite = await service.validate_token(token)
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invite link is invalid, expired, or already used",
        )
    return invite


@router.get("/{token}", response_model=OnboardingOrgInfo)
async def validate_invite(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Validate invite token and return org info for form branding."""
    invite = await _get_valid_invite(token, session)
    service = OnboardingService(session)
    org = await service.get_org_for_invite(invite)
    return {"organization_name": org.name}


@router.post("/{token}/vin/{vin}")
async def decode_vin(
    token: str,
    vin: str,
    session: AsyncSession = Depends(get_session),
):
    """Decode a VIN for the onboarding form (no JWT required)."""
    await _get_valid_invite(token, session)
    vin_service = VinService()
    try:
        info = await vin_service.decode(vin)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return info


@router.post("/{token}/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    token: str,
    body: UploadUrlRequest,
    session: AsyncSession = Depends(get_session),
):
    """Generate a presigned R2 upload URL for the client."""
    invite = await _get_valid_invite(token, session)
    try:
        r2_key = generate_object_key(invite.organization_id, body.filename)
        url = generate_upload_url(r2_key, body.content_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return {"upload_url": url, "r2_key": r2_key}


@router.post("/{token}/submit", response_model=OnboardingResult)
async def submit_onboarding(
    token: str,
    body: OnboardingSubmission,
    session: AsyncSession = Depends(get_session),
):
    """Submit the onboarding form. Creates User, Vehicle, WorkOrder."""
    invite = await _get_valid_invite(token, session)
    service = OnboardingService(session)

    try:
        result = await service.submit_onboarding(
            invite=invite,
            first_name=body.first_name,
            last_name=body.last_name,
            phone=body.phone,
            company_name=body.company_name,
            address=body.address,
            vehicle_data=body.vehicle.model_dump(exclude_none=True),
            job_type=body.job_type,
            project_description=body.project_description,
            referral_source=body.referral_source,
            file_keys=[fk.model_dump() for fk in body.file_keys],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    await session.commit()

    # Send magic link for portal access
    from app.services.auth import AuthService

    auth_service = AuthService(session)
    magic_token = await auth_service.request_magic_link(invite.email)
    if magic_token:
        await send_magic_link_email(invite.email, magic_token)

    return {
        "message": "Onboarding complete. Check your email for portal access.",
        "work_order_id": result["work_order_id"],
        "job_number": result["job_number"],
    }
```

### Test `backend/tests/test_routers/test_onboarding_routes.py`

```python
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
from app.models.client_invite import ClientInvite
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User


@pytest.fixture
async def seed_data(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Wrap Shop", slug="wrap-shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Lead",
        system_status=SystemStatus.LEAD,
        position=0,
        is_default=True,
    )
    db_session.add(stage)

    admin = User(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="admin@wrapshop.com",
        password_hash="hashed",
        role=Role.ADMIN,
    )
    db_session.add(admin)
    await db_session.flush()

    token = secrets.token_urlsafe(32)
    invite = ClientInvite(
        id=uuid.uuid4(),
        organization_id=org.id,
        email="client@example.com",
        token=token,
        invited_by=admin.id,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db_session.add(invite)
    await db_session.commit()

    return {
        "plan": plan,
        "org": org,
        "stage": stage,
        "admin": admin,
        "invite": invite,
        "token": token,
    }


@pytest.fixture
async def client(db_session, seed_data):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def test_validate_invite(client, seed_data):
    token = seed_data["token"]
    resp = await client.get(f"/api/portal/onboarding/{token}")
    assert resp.status_code == 200
    assert resp.json()["organization_name"] == "Wrap Shop"


async def test_validate_invite_invalid_token(client):
    resp = await client.get("/api/portal/onboarding/invalid-token-xyz")
    assert resp.status_code == 410


async def test_validate_invite_expired(client, seed_data, db_session):
    invite = seed_data["invite"]
    invite.expires_at = datetime.now(UTC) - timedelta(hours=1)
    await db_session.commit()

    resp = await client.get(f"/api/portal/onboarding/{seed_data['token']}")
    assert resp.status_code == 410


async def test_validate_invite_already_used(client, seed_data, db_session):
    invite = seed_data["invite"]
    invite.accepted_at = datetime.now(UTC)
    await db_session.commit()

    resp = await client.get(f"/api/portal/onboarding/{seed_data['token']}")
    assert resp.status_code == 410


@patch("app.routers.onboarding.generate_upload_url", return_value="https://r2.example.com/signed")
@patch("app.routers.onboarding.generate_object_key", return_value="org/onboarding/abc_photo.jpg")
async def test_get_upload_url(mock_key, mock_url, client, seed_data):
    token = seed_data["token"]
    resp = await client.post(
        f"/api/portal/onboarding/{token}/upload-url",
        json={"filename": "photo.jpg", "content_type": "image/jpeg"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["upload_url"] == "https://r2.example.com/signed"
    assert data["r2_key"] == "org/onboarding/abc_photo.jpg"


async def test_get_upload_url_bad_content_type(client, seed_data):
    token = seed_data["token"]
    resp = await client.post(
        f"/api/portal/onboarding/{token}/upload-url",
        json={"filename": "virus.exe", "content_type": "application/x-executable"},
    )
    assert resp.status_code == 400


@patch("app.routers.onboarding.send_magic_link_email", new_callable=AsyncMock)
async def test_submit_onboarding(mock_email, client, seed_data):
    token = seed_data["token"]
    resp = await client.post(
        f"/api/portal/onboarding/{token}/submit",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "phone": "555-1234",
            "company_name": "Doe Fleet",
            "address": "123 Main St",
            "vehicle": {
                "year": 2024,
                "make": "Ford",
                "model": "Transit",
            },
            "job_type": "commercial",
            "project_description": "Full fleet wrap",
            "referral_source": "Google",
            "file_keys": [],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "Onboarding complete. Check your email for portal access."
    assert data["job_number"] == "WO-00001"
    assert data["work_order_id"] is not None


@patch("app.routers.onboarding.send_magic_link_email", new_callable=AsyncMock)
async def test_submit_onboarding_already_used(mock_email, client, seed_data):
    token = seed_data["token"]

    # First submit
    await client.post(
        f"/api/portal/onboarding/{token}/submit",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "vehicle": {"year": 2024, "make": "Ford", "model": "Transit"},
            "file_keys": [],
        },
    )

    # Second submit — token now used
    resp = await client.post(
        f"/api/portal/onboarding/{token}/submit",
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "vehicle": {"year": 2024, "make": "Ford", "model": "Transit"},
            "file_keys": [],
        },
    )
    assert resp.status_code == 410
```

### Run & verify

```bash
cd backend && uv run ruff check app/routers/onboarding.py tests/test_routers/test_onboarding_routes.py && uv run ruff format app/routers/onboarding.py tests/test_routers/test_onboarding_routes.py
cd backend && uv run pytest tests/test_routers/test_onboarding_routes.py -v
```

### Commit

```bash
git add backend/app/routers/onboarding.py backend/tests/test_routers/test_onboarding_routes.py
git commit -m "$(cat <<'EOF'
feat(api): add client onboarding portal routes

Token-authenticated endpoints: validate invite, VIN decode,
presigned upload URL, and form submission that creates
User + Vehicle + WorkOrder + FileUpload records.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Register Routes in main.py + Alembic Migration

**Goal:** Register new routers and create migration for new tables.

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/alembic/versions/006_add_onboarding_models.py`

### Update `backend/app/main.py`

Add imports:
```python
from app.routers.client_invites import router as client_invites_router
from app.routers.onboarding import router as onboarding_router
```

Add includes (in alphabetical order with existing routers):
```python
app.include_router(client_invites_router)
app.include_router(onboarding_router)
```

### Create migration `backend/alembic/versions/006_add_onboarding_models.py`

```python
"""Add onboarding models (user_profiles, client_invites, file_uploads)

Revision ID: 006
Revises: 005
Create Date: 2026-03-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), unique=True, index=True, nullable=False),
        sa.Column("first_name", sa.String(255), nullable=True),
        sa.Column("last_name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "client_invites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), index=True, nullable=False),
        sa.Column("email", sa.String(255), index=True, nullable=False),
        sa.Column("token", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("invited_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "file_uploads",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id"), index=True, nullable=False),
        sa.Column("uploaded_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("work_order_id", sa.Uuid(), sa.ForeignKey("work_orders.id"), index=True, nullable=True),
        sa.Column("r2_key", sa.String(1024), unique=True, nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("file_uploads")
    op.drop_table("client_invites")
    op.drop_table("user_profiles")
```

### Run & verify

```bash
cd backend && uv run ruff check app/main.py && uv run ruff format app/main.py
cd backend && uv run python -c "from app.main import app; print(f'Routes: {len(app.routes)}')"
```

### Commit

```bash
git add backend/app/main.py backend/alembic/versions/006_add_onboarding_models.py
git commit -m "$(cat <<'EOF'
feat(app): register onboarding routers and add migration

Register client_invites and onboarding routers in main.py.
Migration 006 creates user_profiles, client_invites, file_uploads tables.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Full Test Suite + Lint

**Goal:** Run the complete test suite and lint pass.

### Run lint

```bash
cd backend && uv run ruff check app/ tests/ && uv run ruff format --check app/ tests/
```

### Run full test suite

```bash
cd backend && uv run pytest -v --tb=short
```

Expected: all tests pass, including:

- `tests/test_models/test_user_profile.py` — 2 tests
- `tests/test_models/test_client_invite.py` — 1 test
- `tests/test_models/test_file_upload.py` — 1 test
- `tests/test_services/test_r2_service.py` — 7 tests
- `tests/test_services/test_onboarding_service.py` — 9 tests
- `tests/test_routers/test_client_invites.py` — 3 tests
- `tests/test_routers/test_onboarding_routes.py` — 7 tests
- All existing tests continue to pass

### Commit (only if lint fixes needed)

```bash
git add -A
git commit -m "$(cat <<'EOF'
style: lint fixes for client onboarding feature

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Files Summary

### New files

| File | Purpose |
|------|---------|
| `backend/app/models/user_profile.py` | UserProfile model (1:1 with User) |
| `backend/app/models/client_invite.py` | ClientInvite model (org-scoped) |
| `backend/app/models/file_upload.py` | FileUpload model (R2 metadata) |
| `backend/app/services/r2.py` | Cloudflare R2 presigned URL service |
| `backend/app/schemas/onboarding.py` | Pydantic schemas for onboarding API |
| `backend/app/services/onboarding.py` | Onboarding business logic |
| `backend/app/routers/client_invites.py` | Admin invite endpoints |
| `backend/app/routers/onboarding.py` | Client onboarding portal endpoints |
| `backend/alembic/versions/006_add_onboarding_models.py` | Migration for 3 new tables |

### Modified files

| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Import UserProfile, ClientInvite, FileUpload |
| `backend/app/config.py` | Add R2 config settings |
| `backend/app/services/email.py` | Add `send_onboarding_invite_email` |
| `backend/app/main.py` | Register client_invites and onboarding routers |
| `backend/tests/conftest.py` | Add new tables to _DROP_TABLES |
| `backend/pyproject.toml` | Add boto3 dependency |
