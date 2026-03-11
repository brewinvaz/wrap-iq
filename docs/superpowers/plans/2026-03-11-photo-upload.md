# Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add photo upload to the project detail Photos tab, using presigned R2 URLs, with before/after/uncategorized categorization.

**Architecture:** Presigned URL upload pattern (mirrors onboarding). Frontend requests upload URL → uploads directly to R2 → registers metadata with backend. Photos stored as `FileUpload` records with new `photo_type` and `caption` columns.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, boto3 (R2), React 19, Next.js 15, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-photo-upload-design.md`

---

## Chunk 1: Backend — Data Model & Schemas

### Task 1: Add photo_type and caption columns to FileUpload model

**Files:**
- Modify: `backend/app/models/file_upload.py`

- [ ] **Step 1: Add columns to FileUpload model**

Add `photo_type` and `caption` columns:

```python
from sqlalchemy import ForeignKey, Integer, String, Uuid
# ... existing imports ...

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
    photo_type: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)

    uploader = relationship("User", lazy="selectin")
    work_order = relationship("WorkOrder", lazy="selectin")
```

- [ ] **Step 2: Verify model imports still work**

Run: `cd backend && uv run python -c "from app.models.file_upload import FileUpload; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/file_upload.py
git commit -m "feat: add photo_type and caption columns to FileUpload model"
```

### Task 2: Create Alembic migration

**Files:**
- Create: `backend/alembic/versions/014_add_photo_fields_to_file_uploads.py`

- [ ] **Step 1: Create migration file**

```python
"""add photo_type and caption to file_uploads

Revision ID: 014
Revises: 013
Create Date: 2026-03-11

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "014"
down_revision: str = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("file_uploads", sa.Column("photo_type", sa.String(20), nullable=True))
    op.add_column("file_uploads", sa.Column("caption", sa.String(500), nullable=True))
    op.create_index("ix_file_uploads_photo_type", "file_uploads", ["photo_type"])


def downgrade() -> None:
    op.drop_index("ix_file_uploads_photo_type", table_name="file_uploads")
    op.drop_column("file_uploads", "caption")
    op.drop_column("file_uploads", "photo_type")
```

- [ ] **Step 2: Run migration**

Run: `make migrate`
Expected: Migration applies successfully

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/014_add_photo_fields_to_file_uploads.py
git commit -m "feat: add migration for photo_type and caption on file_uploads"
```

### Task 3: Create photo schemas

**Files:**
- Create: `backend/app/schemas/work_order_photos.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_schemas/test_work_order_photo_schemas.py`:

```python
"""Tests for work order photo schemas."""

import uuid

import pytest
from pydantic import ValidationError

from app.schemas.work_order_photos import (
    PhotoRegisterFile,
    PhotoRegisterRequest,
    PhotoUpdateRequest,
    PhotoUploadUrlRequest,
)


class TestPhotoUploadUrlRequest:
    def test_valid_jpeg(self):
        req = PhotoUploadUrlRequest(filename="test.jpg", content_type="image/jpeg")
        assert req.filename == "test.jpg"

    def test_valid_png(self):
        req = PhotoUploadUrlRequest(filename="test.png", content_type="image/png")
        assert req.content_type == "image/png"

    def test_valid_webp(self):
        req = PhotoUploadUrlRequest(filename="test.webp", content_type="image/webp")
        assert req.content_type == "image/webp"


class TestPhotoRegisterRequest:
    def test_valid_single_file(self):
        req = PhotoRegisterRequest(
            files=[
                PhotoRegisterFile(
                    r2_key="org-id/photos/abc_test.jpg",
                    filename="test.jpg",
                    content_type="image/jpeg",
                    size_bytes=1_000_000,
                )
            ]
        )
        assert len(req.files) == 1

    def test_max_five_files(self):
        files = [
            PhotoRegisterFile(
                r2_key=f"org-id/photos/{i}_test.jpg",
                filename=f"test{i}.jpg",
                content_type="image/jpeg",
                size_bytes=100_000,
            )
            for i in range(5)
        ]
        req = PhotoRegisterRequest(files=files)
        assert len(req.files) == 5

    def test_rejects_more_than_five_files(self):
        files = [
            PhotoRegisterFile(
                r2_key=f"org-id/photos/{i}_test.jpg",
                filename=f"test{i}.jpg",
                content_type="image/jpeg",
                size_bytes=100_000,
            )
            for i in range(6)
        ]
        with pytest.raises(ValidationError, match="at most 5"):
            PhotoRegisterRequest(files=files)

    def test_rejects_empty_files(self):
        with pytest.raises(ValidationError, match="at least 1"):
            PhotoRegisterRequest(files=[])


class TestPhotoUpdateRequest:
    def test_valid_before_type(self):
        req = PhotoUpdateRequest(photo_type="before")
        assert req.photo_type == "before"

    def test_valid_after_type(self):
        req = PhotoUpdateRequest(photo_type="after")
        assert req.photo_type == "after"

    def test_null_type_for_uncategorized(self):
        req = PhotoUpdateRequest(photo_type=None)
        assert req.photo_type is None

    def test_valid_caption(self):
        req = PhotoUpdateRequest(caption="Front bumper")
        assert req.caption == "Front bumper"

    def test_rejects_caption_over_500_chars(self):
        with pytest.raises(ValidationError):
            PhotoUpdateRequest(caption="x" * 501)

    def test_rejects_invalid_photo_type(self):
        with pytest.raises(ValidationError):
            PhotoUpdateRequest(photo_type="invalid")
```

Note: Create the `backend/tests/test_schemas/` directory if it doesn't exist: `mkdir -p backend/tests/test_schemas`

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_schemas/test_work_order_photo_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.work_order_photos'`

- [ ] **Step 3: Create schemas file**

Create `backend/app/schemas/work_order_photos.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_schemas/test_work_order_photo_schemas.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/work_order_photos.py backend/tests/test_schemas/test_work_order_photo_schemas.py
git commit -m "feat: add work order photo schemas with validation"
```

---

## Chunk 2: Backend — Router & Endpoints

### Task 4: Create photo router with upload-url endpoint

**Files:**
- Create: `backend/app/routers/work_order_photos.py`
- Create: `backend/tests/test_routers/test_work_order_photos.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing test for upload-url endpoint**

Create `backend/tests/test_routers/test_work_order_photos.py`:

```python
"""Tests for work order photo endpoints."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.main import app
from app.models.user import User

ORG_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
WORK_ORDER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = USER_ID
    user.organization_id = ORG_ID
    user.is_active = True
    return user


@pytest.fixture
def mock_session():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
async def client(mock_user, mock_session):
    async def override_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = lambda: mock_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


class TestUploadUrl:
    async def test_returns_presigned_url(self, client):
        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True), \
             patch("app.routers.work_order_photos.generate_object_key", return_value=f"{ORG_ID}/photos/abc_test.jpg"), \
             patch("app.routers.work_order_photos.generate_upload_url", return_value="https://r2.example.com/presigned"):
            resp = await client.post(
                f"/api/work-orders/{WORK_ORDER_ID}/photos/upload-url",
                json={"filename": "test.jpg", "content_type": "image/jpeg"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["upload_url"] == "https://r2.example.com/presigned"
        assert data["r2_key"] == f"{ORG_ID}/photos/abc_test.jpg"

    async def test_rejects_pdf_content_type(self, client):
        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True):
            resp = await client.post(
                f"/api/work-orders/{WORK_ORDER_ID}/photos/upload-url",
                json={"filename": "doc.pdf", "content_type": "application/pdf"},
            )
        assert resp.status_code == 400
        assert "image" in resp.json()["detail"].lower()

    async def test_returns_503_when_r2_not_configured(self, client):
        with patch("app.routers.work_order_photos.is_r2_configured", return_value=False):
            resp = await client.post(
                f"/api/work-orders/{WORK_ORDER_ID}/photos/upload-url",
                json={"filename": "test.jpg", "content_type": "image/jpeg"},
            )
        assert resp.status_code == 503
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/test_routers/test_work_order_photos.py::TestUploadUrl -v`
Expected: FAIL — 404 (router not registered)

- [ ] **Step 3: Create router and register it**

Create `backend/app/routers/work_order_photos.py`:

```python
"""Work order photo management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.file_upload import FileUpload
from app.models.user import User
from app.schemas.work_order_photos import (
    PhotoListResponse,
    PhotoRegisterRequest,
    PhotoResponse,
    PhotoUpdateRequest,
    PhotoUploadUrlRequest,
    PhotoUploadUrlResponse,
)
from app.services.r2 import (
    delete_object,
    generate_download_url,
    generate_object_key,
    generate_upload_url,
    is_r2_configured,
    validate_file_keys,
)

router = APIRouter(
    prefix="/api/work-orders/{work_order_id}/photos",
    tags=["work-order-photos"],
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _check_r2():
    if not is_r2_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File storage not configured",
        )


@router.post("/upload-url", response_model=PhotoUploadUrlResponse)
async def get_photo_upload_url(
    work_order_id: uuid.UUID,
    body: PhotoUploadUrlRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Generate a presigned R2 upload URL for a photo."""
    _check_r2()

    if body.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only image files allowed. Accepted types: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}",
        )

    try:
        r2_key = generate_object_key(user.organization_id, body.filename, prefix="photos")
        url = generate_upload_url(r2_key, body.content_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {"upload_url": url, "r2_key": r2_key}
```

Add to `backend/app/main.py` — add the import and `app.include_router(...)` line following the existing pattern. Import:

```python
from app.routers.work_order_photos import router as work_order_photos_router
```

Register:

```python
app.include_router(work_order_photos_router)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_routers/test_work_order_photos.py::TestUploadUrl -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/work_order_photos.py backend/app/main.py backend/tests/test_routers/test_work_order_photos.py
git commit -m "feat: add photo upload-url endpoint"
```

### Task 5: Add photo register endpoint (POST /photos)

**Files:**
- Modify: `backend/app/routers/work_order_photos.py`
- Modify: `backend/tests/test_routers/test_work_order_photos.py`

- [ ] **Step 1: Write failing tests for register endpoint**

Add to `backend/tests/test_routers/test_work_order_photos.py`:

```python
class TestRegisterPhotos:
    async def test_registers_photos_successfully(self, client, mock_session):
        files = [
            {
                "r2_key": f"{ORG_ID}/photos/abc_test.jpg",
                "filename": "test.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 500_000,
            }
        ]
        # Patch commit to set created_at on the FileUpload objects (TimestampMixin default
        # only fires on real DB flush, not with mock sessions)
        from datetime import datetime, timezone

        original_commit = mock_session.commit

        async def fake_commit():
            # Simulate what SQLAlchemy would do on flush
            for obj in mock_session.add.call_args_list:
                upload = obj[0][0]
                if not hasattr(upload, 'created_at') or upload.created_at is None:
                    upload.created_at = datetime.now(timezone.utc)
                if not hasattr(upload, 'updated_at') or upload.updated_at is None:
                    upload.updated_at = datetime.now(timezone.utc)

        mock_session.commit = AsyncMock(side_effect=fake_commit)

        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True), \
             patch("app.routers.work_order_photos.validate_file_keys"), \
             patch("app.routers.work_order_photos.generate_download_url", return_value="https://r2.example.com/signed"):
            resp = await client.post(
                f"/api/work-orders/{WORK_ORDER_ID}/photos",
                json={"files": files},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 1
        assert data[0]["filename"] == "test.jpg"

    async def test_rejects_pdf_in_register(self, client):
        files = [
            {
                "r2_key": f"{ORG_ID}/photos/abc_doc.pdf",
                "filename": "doc.pdf",
                "content_type": "application/pdf",
                "size_bytes": 500_000,
            }
        ]
        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True):
            resp = await client.post(
                f"/api/work-orders/{WORK_ORDER_ID}/photos",
                json={"files": files},
            )
        assert resp.status_code == 400

    async def test_rejects_cross_org_keys(self, client):
        other_org = uuid.uuid4()
        files = [
            {
                "r2_key": f"{other_org}/photos/abc_test.jpg",
                "filename": "test.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 500_000,
            }
        ]
        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True), \
             patch("app.routers.work_order_photos.validate_file_keys", side_effect=ValueError("does not belong to organization")):
            resp = await client.post(
                f"/api/work-orders/{WORK_ORDER_ID}/photos",
                json={"files": files},
            )
        assert resp.status_code == 400

    async def test_returns_503_when_r2_not_configured(self, client):
        with patch("app.routers.work_order_photos.is_r2_configured", return_value=False):
            resp = await client.post(
                f"/api/work-orders/{WORK_ORDER_ID}/photos",
                json={"files": [{"r2_key": "x", "filename": "x", "content_type": "image/jpeg", "size_bytes": 1}]},
            )
        assert resp.status_code == 503
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_routers/test_work_order_photos.py::TestRegisterPhotos -v`
Expected: FAIL — 405 Method Not Allowed (endpoint doesn't exist yet)

- [ ] **Step 3: Add register endpoint to router**

Add to `backend/app/routers/work_order_photos.py`:

```python
@router.post("", status_code=status.HTTP_201_CREATED)
async def register_photos(
    work_order_id: uuid.UUID,
    body: PhotoRegisterRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Register photos that have been uploaded to R2."""
    _check_r2()

    # Validate all files are images (not PDFs)
    for f in body.files:
        if f.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only image files allowed. Got: {f.content_type}",
            )

    # Validate file keys belong to user's org
    file_key_dicts = [f.model_dump() for f in body.files]
    try:
        validate_file_keys(user.organization_id, file_key_dicts)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Create FileUpload records
    created = []
    for f in body.files:
        upload = FileUpload(
            uploaded_by=user.id,
            organization_id=user.organization_id,
            work_order_id=work_order_id,
            r2_key=f.r2_key,
            filename=f.filename,
            content_type=f.content_type,
            size_bytes=f.size_bytes,
        )
        session.add(upload)
        created.append(upload)

    await session.commit()

    # Generate download URLs for response
    photos = []
    for upload in created:
        url = generate_download_url(upload.r2_key)
        photos.append(
            PhotoResponse(
                id=upload.id,
                filename=upload.filename,
                content_type=upload.content_type,
                size_bytes=upload.size_bytes,
                photo_type=upload.photo_type,
                caption=upload.caption,
                url=url,
                created_at=upload.created_at,
            )
        )

    return photos
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_routers/test_work_order_photos.py::TestRegisterPhotos -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/work_order_photos.py backend/tests/test_routers/test_work_order_photos.py
git commit -m "feat: add photo register endpoint"
```

### Task 6: Add GET, PATCH, DELETE photo endpoints

**Files:**
- Modify: `backend/app/routers/work_order_photos.py`
- Modify: `backend/tests/test_routers/test_work_order_photos.py`

- [ ] **Step 1: Write failing tests for list, update, and delete**

Add to `backend/tests/test_routers/test_work_order_photos.py`:

```python
class TestListPhotos:
    async def test_returns_empty_list(self, client, mock_session):
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True):
            resp = await client.get(f"/api/work-orders/{WORK_ORDER_ID}/photos")
        assert resp.status_code == 200
        assert resp.json()["photos"] == []


class TestUpdatePhoto:
    async def test_update_photo_type(self, client, mock_session):
        photo_id = uuid.uuid4()
        mock_upload = MagicMock(spec=FileUpload)
        mock_upload.id = photo_id
        mock_upload.organization_id = ORG_ID
        mock_upload.work_order_id = WORK_ORDER_ID
        mock_upload.filename = "test.jpg"
        mock_upload.content_type = "image/jpeg"
        mock_upload.size_bytes = 500_000
        mock_upload.photo_type = "before"
        mock_upload.caption = None
        mock_upload.r2_key = f"{ORG_ID}/photos/abc_test.jpg"
        mock_upload.created_at = "2026-03-11T00:00:00"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_upload
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True), \
             patch("app.routers.work_order_photos.generate_download_url", return_value="https://r2.example.com/signed"):
            resp = await client.patch(
                f"/api/work-orders/{WORK_ORDER_ID}/photos/{photo_id}",
                json={"photo_type": "before"},
            )
        assert resp.status_code == 200

    async def test_returns_404_for_missing_photo(self, client, mock_session):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True):
            resp = await client.patch(
                f"/api/work-orders/{WORK_ORDER_ID}/photos/{uuid.uuid4()}",
                json={"photo_type": "after"},
            )
        assert resp.status_code == 404


class TestDeletePhoto:
    async def test_deletes_photo(self, client, mock_session):
        photo_id = uuid.uuid4()
        mock_upload = MagicMock(spec=FileUpload)
        mock_upload.id = photo_id
        mock_upload.organization_id = ORG_ID
        mock_upload.work_order_id = WORK_ORDER_ID
        mock_upload.r2_key = f"{ORG_ID}/photos/abc_test.jpg"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_upload
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True), \
             patch("app.routers.work_order_photos.delete_object"):
            resp = await client.delete(
                f"/api/work-orders/{WORK_ORDER_ID}/photos/{photo_id}"
            )
        assert resp.status_code == 204

    async def test_returns_404_for_missing_photo(self, client, mock_session):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("app.routers.work_order_photos.is_r2_configured", return_value=True):
            resp = await client.delete(
                f"/api/work-orders/{WORK_ORDER_ID}/photos/{uuid.uuid4()}"
            )
        assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_routers/test_work_order_photos.py::TestListPhotos tests/test_routers/test_work_order_photos.py::TestUpdatePhoto tests/test_routers/test_work_order_photos.py::TestDeletePhoto -v`
Expected: FAIL — 405 Method Not Allowed

- [ ] **Step 3: Add GET, PATCH, DELETE endpoints**

Add to `backend/app/routers/work_order_photos.py`:

```python
@router.get("", response_model=PhotoListResponse)
async def list_photos(
    work_order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all photos for a work order."""
    _check_r2()

    result = await session.execute(
        select(FileUpload)
        .where(
            FileUpload.work_order_id == work_order_id,
            FileUpload.organization_id == user.organization_id,
            FileUpload.content_type.in_(ALLOWED_IMAGE_TYPES),
        )
        .order_by(FileUpload.created_at)
    )
    uploads = result.scalars().all()

    photos = []
    for upload in uploads:
        url = generate_download_url(upload.r2_key)
        photos.append(
            PhotoResponse(
                id=upload.id,
                filename=upload.filename,
                content_type=upload.content_type,
                size_bytes=upload.size_bytes,
                photo_type=upload.photo_type,
                caption=upload.caption,
                url=url,
                created_at=upload.created_at,
            )
        )

    return {"photos": photos}


async def _get_photo_or_404(
    photo_id: uuid.UUID,
    work_order_id: uuid.UUID,
    org_id: uuid.UUID,
    session: AsyncSession,
) -> FileUpload:
    result = await session.execute(
        select(FileUpload).where(
            FileUpload.id == photo_id,
            FileUpload.work_order_id == work_order_id,
            FileUpload.organization_id == org_id,
        )
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )
    return upload


@router.patch("/{photo_id}", response_model=PhotoResponse)
async def update_photo(
    work_order_id: uuid.UUID,
    photo_id: uuid.UUID,
    body: PhotoUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update photo metadata (category, caption)."""
    _check_r2()

    upload = await _get_photo_or_404(photo_id, work_order_id, user.organization_id, session)

    if body.photo_type is not None:
        upload.photo_type = body.photo_type
    elif body.model_fields_set and "photo_type" in body.model_fields_set:
        # Explicitly set to null (uncategorize)
        upload.photo_type = None

    if body.caption is not None:
        upload.caption = body.caption
    elif "caption" in body.model_fields_set:
        upload.caption = None

    await session.commit()

    url = generate_download_url(upload.r2_key)
    return PhotoResponse(
        id=upload.id,
        filename=upload.filename,
        content_type=upload.content_type,
        size_bytes=upload.size_bytes,
        photo_type=upload.photo_type,
        caption=upload.caption,
        url=url,
        created_at=upload.created_at,
    )


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    work_order_id: uuid.UUID,
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a photo from R2 and database."""
    _check_r2()

    upload = await _get_photo_or_404(photo_id, work_order_id, user.organization_id, session)

    delete_object(upload.r2_key)
    await session.delete(upload)
    await session.commit()
```

- [ ] **Step 4: Run all photo router tests**

Run: `cd backend && uv run pytest tests/test_routers/test_work_order_photos.py -v`
Expected: All tests PASS

- [ ] **Step 5: Run linting**

Run: `cd backend && uv run ruff check app/routers/work_order_photos.py app/schemas/work_order_photos.py && uv run ruff format app/routers/work_order_photos.py app/schemas/work_order_photos.py`
Expected: Clean or auto-fixed

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/work_order_photos.py backend/tests/test_routers/test_work_order_photos.py
git commit -m "feat: add list, update, and delete photo endpoints"
```

---

## Chunk 3: Frontend — Upload Component & Integration

### Task 7: Update TypeScript types

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **Step 1: Add WorkOrderPhoto type and update ProjectPhoto**

In `frontend/src/lib/types.ts`, add:

```typescript
export interface WorkOrderPhoto {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  photo_type: 'before' | 'after' | null;
  caption: string | null;
  url: string;
  created_at: string;
}
```

Update existing `ProjectPhoto`:

```typescript
export interface ProjectPhoto {
  id: string;
  url: string;
  type: 'before' | 'after' | null;
  caption?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat: add WorkOrderPhoto type and update ProjectPhoto for null type"
```

### Task 8: Build the PhotoUploadZone component

**Files:**
- Create: `frontend/src/components/PhotoUploadZone.tsx`

- [ ] **Step 1: Create the upload component**

Create `frontend/src/components/PhotoUploadZone.tsx`:

```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api-client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'registering' | 'done' | 'error';
  error?: string;
}

interface PhotoUploadZoneProps {
  workOrderId: string;
  onUploadComplete: () => void;
}

export default function PhotoUploadZone({ workOrderId, onUploadComplete }: PhotoUploadZoneProps) {
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
    const errors: string[] = [];
    const valid: File[] = [];

    if (files.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} files per upload`);
      return { valid: [], errors };
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Only PNG, JPG, and WebP files are allowed`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File exceeds 10MB limit`);
        continue;
      }
      valid.push(file);
    }

    return { valid, errors };
  };

  const uploadFile = async (
    file: File,
    index: number,
    updateProgress: (index: number, updates: Partial<UploadingFile>) => void,
  ): Promise<{ r2_key: string; filename: string; content_type: string; size_bytes: number } | null> => {
    try {
      // Step 1: Get presigned URL
      const { upload_url, r2_key } = await api.post<{ upload_url: string; r2_key: string }>(
        `/api/work-orders/${workOrderId}/photos/upload-url`,
        { filename: file.name, content_type: file.type },
      );

      // Step 2: Upload to R2 via XHR (for progress tracking)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            updateProgress(index, { progress: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      return { r2_key, filename: file.name, content_type: file.type, size_bytes: file.size };
    } catch (err) {
      updateProgress(index, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      });
      return null;
    }
  };

  const handleFiles = useCallback(async (files: File[]) => {
    const { valid, errors } = validateFiles(files);

    if (errors.length > 0) {
      // Show first error for now
      alert(errors[0]);
    }

    if (valid.length === 0) return;

    const uploadStates: UploadingFile[] = valid.map((file) => ({
      file,
      progress: 0,
      status: 'uploading',
    }));
    setUploading(uploadStates);

    const updateProgress = (index: number, updates: Partial<UploadingFile>) => {
      setUploading((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
    };

    // Upload all files in parallel
    const results = await Promise.all(
      valid.map((file, index) => uploadFile(file, index, updateProgress)),
    );

    const successful = results.filter(Boolean) as {
      r2_key: string;
      filename: string;
      content_type: string;
      size_bytes: number;
    }[];

    if (successful.length > 0) {
      try {
        // Step 3: Register with backend
        setUploading((prev) => prev.map((item) =>
          item.status === 'uploading' ? { ...item, status: 'registering', progress: 100 } : item,
        ));

        await api.post(`/api/work-orders/${workOrderId}/photos`, { files: successful });

        setUploading((prev) => prev.map((item) =>
          item.status === 'registering' ? { ...item, status: 'done' } : item,
        ));

        // Clear and refresh
        setTimeout(() => {
          setUploading([]);
          onUploadComplete();
        }, 1000);
      } catch {
        setUploading((prev) => prev.map((item) =>
          item.status === 'registering'
            ? { ...item, status: 'error', error: 'Failed to register photos' }
            : item,
        ));
      }
    }
  }, [workOrderId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = () => fileInputRef.current?.click();

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset for re-upload of same file
    }
  };

  const isUploading = uploading.some((f) => f.status === 'uploading' || f.status === 'registering');

  return (
    <div>
      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50/50'
            : 'border-[#e6e6eb] bg-white hover:border-blue-300 hover:bg-blue-50/30'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInput}
          className="hidden"
        />
        <svg
          className="mx-auto mb-3 h-10 w-10 text-[#a8a8b4]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
          />
        </svg>
        <p className="text-sm font-medium text-[#60606a]">
          Drop photos here or click to upload
        </p>
        <p className="mt-1 text-xs text-[#a8a8b4]">
          PNG, JPG, WebP up to 10MB
        </p>
      </div>

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploading.map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-white p-3 text-sm">
              <span className="flex-1 truncate text-[#60606a]">{item.file.name}</span>
              {item.status === 'error' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">{item.error}</span>
                  <button
                    onClick={() => handleFiles([item.file])}
                    className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100"
                  >
                    Retry
                  </button>
                </div>
              ) : item.status === 'done' ? (
                <span className="text-xs text-green-600">Done</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-[#e6e6eb]">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-[#a8a8b4]">{item.progress}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to PhotoUploadZone

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PhotoUploadZone.tsx
git commit -m "feat: add PhotoUploadZone component with drag-drop and progress"
```

### Task 9: Wire up PhotosTab with real API data

**Files:**
- Modify: `frontend/src/app/dashboard/projects/[id]/page.tsx`

- [ ] **Step 1: Update PhotosTab to fetch photos and use upload component**

Replace the `PhotosTab` function (lines ~902-946) with:

```tsx
function PhotosTab({ project, workOrderId }: { project: ProjectDetail; workOrderId: string }) {
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = useCallback(async () => {
    try {
      const data = await api.get<{ photos: WorkOrderPhoto[] }>(
        `/api/work-orders/${workOrderId}/photos`,
      );
      setPhotos(data.photos);
    } catch {
      // Silently fail — empty state is fine
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const beforePhotos = photos.filter((p) => p.photo_type === 'before');
  const afterPhotos = photos.filter((p) => p.photo_type === 'after');
  const uncategorizedPhotos = photos.filter((p) => p.photo_type === null);

  const handleCategoryChange = async (photoId: string, photoType: 'before' | 'after' | null) => {
    // Optimistic update
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, photo_type: photoType } : p)));
    try {
      await api.patch(`/api/work-orders/${workOrderId}/photos/${photoId}`, { photo_type: photoType });
    } catch {
      fetchPhotos(); // Revert on error
    }
  };

  const handleCaptionChange = async (photoId: string, caption: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption } : p)));
    try {
      await api.patch(`/api/work-orders/${workOrderId}/photos/${photoId}`, { caption });
    } catch {
      fetchPhotos();
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    try {
      await api.delete(`/api/work-orders/${workOrderId}/photos/${photoId}`);
    } catch {
      fetchPhotos();
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-[#a8a8b4]">Loading photos...</div>;
  }

  return (
    <div className="space-y-8">
      <PhotoUploadZone workOrderId={workOrderId} onUploadComplete={fetchPhotos} />

      {beforePhotos.length > 0 && (
        <PhotoSection
          label="Before"
          photos={beforePhotos}
          onCategoryChange={handleCategoryChange}
          onCaptionChange={handleCaptionChange}
          onDelete={handleDelete}
        />
      )}
      {afterPhotos.length > 0 && (
        <PhotoSection
          label="After"
          photos={afterPhotos}
          onCategoryChange={handleCategoryChange}
          onCaptionChange={handleCaptionChange}
          onDelete={handleDelete}
        />
      )}
      {uncategorizedPhotos.length > 0 && (
        <PhotoSection
          label="Uncategorized"
          photos={uncategorizedPhotos}
          onCategoryChange={handleCategoryChange}
          onCaptionChange={handleCaptionChange}
          onDelete={handleDelete}
        />
      )}

      {photos.length === 0 && (
        <div className="py-12 text-center text-sm text-[#a8a8b4]">
          No photos uploaded yet.
        </div>
      )}
    </div>
  );
}
```

Add required imports at the top of the file:

```tsx
import PhotoUploadZone from '@/components/PhotoUploadZone';
import { WorkOrderPhoto } from '@/lib/types';
```

- [ ] **Step 2: Create PhotoSection component**

Add above `PhotosTab` in the same file:

```tsx
function PhotoSection({
  label,
  photos,
  onCategoryChange,
  onDelete,
}: {
  label: string;
  photos: WorkOrderPhoto[];
  onCategoryChange: (id: string, type: 'before' | 'after' | null) => void;
  onCaptionChange: (id: string, caption: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[#1a1a2e]">{label}</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative overflow-hidden rounded-lg border border-[#e6e6eb] bg-white">
            <div className="aspect-square">
              <img
                src={photo.url}
                alt={photo.filename}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-2">
              <p className="truncate text-xs text-[#60606a]">{photo.filename}</p>
              <select
                value={photo.photo_type ?? ''}
                onChange={(e) => onCategoryChange(photo.id, (e.target.value || null) as 'before' | 'after' | null)}
                className="mt-1 w-full rounded border border-[#e6e6eb] bg-white px-2 py-1 text-xs text-[#60606a]"
              >
                <option value="">Uncategorized</option>
                <option value="before">Before</option>
                <option value="after">After</option>
              </select>
              <input
                type="text"
                defaultValue={photo.caption ?? ''}
                placeholder="Add caption..."
                onBlur={(e) => onCaptionChange(photo.id, e.target.value)}
                className="mt-1 w-full rounded border border-[#e6e6eb] bg-white px-2 py-1 text-xs text-[#60606a] placeholder:text-[#c4c4cc]"
                maxLength={500}
              />
            </div>
            <button
              onClick={() => onDelete(photo.id)}
              className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update PhotosTab call site to pass workOrderId**

The page component already has a `workOrderId` state variable (used by other tabs like ChecklistTab, NotesTab). Find where `<PhotosTab project={project} />` is rendered and change to:

```tsx
<PhotosTab project={project} workOrderId={workOrderId} />
```

- [ ] **Step 4: Verify compilation**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/projects/[id]/page.tsx
git commit -m "feat: wire up PhotosTab with real API and upload component"
```

### Task 10: Clean up old PhotoGrid and verify end-to-end

**Files:**
- Modify: `frontend/src/app/dashboard/projects/[id]/page.tsx`

- [ ] **Step 1: Remove or update the old PhotoGrid component**

The old `PhotoGrid` component (which used `ProjectPhoto[]`) can be removed since `PhotoSection` replaces it. Search for the `PhotoGrid` function and remove it if no longer referenced.

- [ ] **Step 2: Run the frontend dev server and verify**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run linting**

Run: `cd frontend && npm run lint 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/projects/[id]/page.tsx
git commit -m "refactor: replace PhotoGrid with PhotoSection component"
```

---

## Chunk 4: Backend Tests & Final Verification

### Task 11: Run full backend test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all backend tests**

Run: `make test`
Expected: All tests pass, including the new photo tests

- [ ] **Step 2: Run linting on all changed files**

Run: `make lint`
Expected: Clean

- [ ] **Step 3: Fix any failures**

If any tests fail, investigate and fix. Do not skip failing tests.

### Task 12: Final integration test

**Files:** None (manual verification)

- [ ] **Step 1: Start the full stack**

Run: `make up`

- [ ] **Step 2: Run migration in container**

Run: `make migrate`

- [ ] **Step 3: Navigate to a project's Photos tab and verify:**
- Upload zone is visible and clickable
- Files can be dragged and dropped
- Progress bars show during upload
- Photos appear after upload
- Category dropdown works (Before/After/Uncategorized)
- Delete button works with confirmation
- Page refreshes preserve photos

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address integration test findings"
```
