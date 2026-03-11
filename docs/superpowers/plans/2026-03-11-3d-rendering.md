# 3D Rendering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock 3D rendering page with AI-powered wrap visualization using Gemini image generation, with full CRUD API and client sharing.

**Architecture:** Backend adds a `renders` table with CRUD endpoints + Gemini integration. Frontend uploads files to R2 via presigned URLs, then creates renders via JSON API. Generated images stored in R2, shareable via public token-based URLs.

**Tech Stack:** FastAPI, SQLAlchemy, Google genai SDK (gemini-2.5-flash-image), Cloudflare R2 (boto3), Next.js 15, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-11-3d-rendering-design.md`

---

## Chunk 1: Backend Model, Migration, R2 Additions

### Task 1: R2 Service Additions

**Files:**
- Modify: `backend/app/services/r2.py`
- Test: `backend/tests/test_renders.py`

- [ ] **Step 1: Write failing tests for R2 additions**

Create `backend/tests/test_renders.py` with tests for the new R2 functions:

```python
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.r2 import (
    download_object,
    generate_object_key,
    upload_object,
)


class TestGenerateObjectKey:
    def test_renders_prefix(self):
        org_id = uuid.uuid4()
        key = generate_object_key(org_id, "photo.jpg", prefix="renders")
        assert key.startswith(f"{org_id}/renders/")
        assert key.endswith("_photo.jpg")

    def test_default_prefix_is_onboarding(self):
        org_id = uuid.uuid4()
        key = generate_object_key(org_id, "file.pdf")
        assert f"{org_id}/onboarding/" in key

    def test_sanitizes_filename(self):
        org_id = uuid.uuid4()
        key = generate_object_key(org_id, "../etc/passwd", prefix="renders")
        assert ".." not in key
        assert "/" not in key.split("/renders/")[1] or "_" in key


class TestUploadObject:
    @patch("app.services.r2._get_client")
    def test_upload_object_calls_put(self, mock_get_client):
        mock_s3 = MagicMock()
        mock_get_client.return_value = mock_s3
        upload_object("org/renders/test.jpg", b"image-data", "image/jpeg")
        mock_s3.put_object.assert_called_once()
        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs["Key"] == "org/renders/test.jpg"
        assert call_kwargs["Body"] == b"image-data"
        assert call_kwargs["ContentType"] == "image/jpeg"


class TestDownloadObject:
    @patch("app.services.r2._get_client")
    def test_download_object_returns_bytes(self, mock_get_client):
        mock_s3 = MagicMock()
        mock_body = MagicMock()
        mock_body.read.return_value = b"image-bytes"
        mock_s3.get_object.return_value = {"Body": mock_body}
        mock_get_client.return_value = mock_s3
        result = download_object("org/renders/test.jpg")
        assert result == b"image-bytes"
        mock_s3.get_object.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec backend /app/.venv/bin/pytest tests/test_renders.py::TestGenerateObjectKey -v`
Expected: FAIL — `generate_object_key` doesn't accept `prefix` param yet

- [ ] **Step 3: Implement R2 additions**

Modify `backend/app/services/r2.py`:

1. Update `generate_object_key` to accept an optional `prefix` parameter (default `"onboarding"`):

```python
def generate_object_key(org_id: uuid.UUID, filename: str, prefix: str = "onboarding") -> str:
    safe_filename = filename.replace("/", "_").replace("\\", "_").replace("..", "")
    unique = uuid.uuid4().hex[:8]
    return f"{org_id}/{prefix}/{unique}_{safe_filename}"
```

2. Add `upload_object` function after `delete_object`:

```python
def upload_object(key: str, data: bytes, content_type: str) -> None:
    """Upload bytes directly to R2."""
    client = _get_client()
    client.put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
```

3. Add `download_object` function after `upload_object`:

```python
def download_object(key: str) -> bytes:
    """Download an object from R2 and return its bytes."""
    client = _get_client()
    response = client.get_object(Bucket=settings.r2_bucket_name, Key=key)
    return response["Body"].read()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec backend /app/.venv/bin/pytest tests/test_renders.py -v -k "R2 or GenerateObjectKey or UploadObject or DownloadObject"`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/r2.py backend/tests/test_renders.py
git commit -m "feat: add upload_object, download_object, and prefix param to r2 service"
```

---

### Task 2: Render Model + Enum

**Files:**
- Create: `backend/app/models/render.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create the Render model**

Create `backend/app/models/render.py`:

```python
import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class RenderStatus(enum.StrEnum):
    PENDING = "pending"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class Render(Base, TenantMixin, TimestampMixin):
    __tablename__ = "renders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), index=True, nullable=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("clients.id"), index=True, nullable=True
    )
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("vehicles.id"), nullable=True
    )
    design_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RenderStatus] = mapped_column(
        Enum(RenderStatus, values_callable=lambda e: [m.value for m in e]),
        default=RenderStatus.PENDING,
    )
    vehicle_photo_key: Mapped[str] = mapped_column(String(500))
    wrap_design_key: Mapped[str] = mapped_column(String(500))
    result_image_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    share_token: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True
    )

    creator = relationship("User", lazy="selectin")
    work_order = relationship("WorkOrder", lazy="selectin")
    client = relationship("Client", lazy="selectin")
    vehicle = relationship("Vehicle", lazy="selectin")
```

- [ ] **Step 2: Register model in `__init__.py`**

Add to `backend/app/models/__init__.py`:

After line 9 (`from app.models.file_upload import FileUpload`), add:
```python
from app.models.render import Render, RenderStatus
```

In the `__all__` list, add `"Render"` and `"RenderStatus"` (alphabetically — after `"RefreshToken"` and before `"Role"`).

- [ ] **Step 3: Verify model loads**

Run: `docker compose exec backend /app/.venv/bin/python -c "from app.models.render import Render, RenderStatus; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/render.py backend/app/models/__init__.py
git commit -m "feat: add Render model with RenderStatus enum"
```

---

### Task 3: Database Migration

**Files:**
- Create: `backend/alembic/versions/014_create_renders_table.py`

- [ ] **Step 1: Create migration file**

Create `backend/alembic/versions/014_create_renders_table.py`:

```python
"""create renders table

Revision ID: 014
Revises: 013
Create Date: 2026-03-11

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: str = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "renders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Uuid(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "work_order_id",
            sa.Uuid(),
            sa.ForeignKey("work_orders.id"),
            nullable=True,
        ),
        sa.Column(
            "client_id", sa.Uuid(), sa.ForeignKey("clients.id"), nullable=True
        ),
        sa.Column(
            "vehicle_id", sa.Uuid(), sa.ForeignKey("vehicles.id"), nullable=True
        ),
        sa.Column("design_name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "rendering", "completed", "failed", name="renderstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("vehicle_photo_key", sa.String(500), nullable=False),
        sa.Column("wrap_design_key", sa.String(500), nullable=False),
        sa.Column("result_image_key", sa.String(500), nullable=True),
        sa.Column("share_token", sa.String(64), nullable=True, unique=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_renders_organization_id", "renders", ["organization_id"])
    op.create_index("ix_renders_work_order_id", "renders", ["work_order_id"])
    op.create_index("ix_renders_client_id", "renders", ["client_id"])
    op.create_index("ix_renders_share_token", "renders", ["share_token"], unique=True)
    op.create_index("ix_renders_created_by", "renders", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_renders_created_by", table_name="renders")
    op.drop_index("ix_renders_share_token", table_name="renders")
    op.drop_index("ix_renders_client_id", table_name="renders")
    op.drop_index("ix_renders_work_order_id", table_name="renders")
    op.drop_index("ix_renders_organization_id", table_name="renders")
    op.drop_table("renders")
    op.execute("DROP TYPE IF EXISTS renderstatus")
```

- [ ] **Step 2: Run migration**

Run: `make migrate`
Expected: Migration applies successfully, `renders` table created

- [ ] **Step 3: Verify table exists**

Run: `docker compose exec db psql -U postgres -d wrapiq -c "\d renders"`
Expected: Table with all columns displayed

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/014_create_renders_table.py
git commit -m "feat: add migration 014 for renders table"
```

---

## Chunk 2: Backend Schemas, Service, Router

### Task 4: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/renders.py`

- [ ] **Step 1: Write schema tests**

Add to `backend/tests/test_renders.py`:

```python
from app.schemas.renders import FileInfo, RenderCreate, RenderUploadRequest


class TestRenderSchemas:
    def test_render_create_valid(self):
        data = RenderCreate(
            design_name="Test Wrap",
            vehicle_photo_key="org/renders/abc_photo.jpg",
            wrap_design_key="org/renders/def_design.png",
        )
        assert data.design_name == "Test Wrap"
        assert data.work_order_id is None

    def test_render_create_missing_design_name(self):
        with pytest.raises(Exception):
            RenderCreate(
                design_name="",
                vehicle_photo_key="key1",
                wrap_design_key="key2",
            )

    def test_upload_request_max_two_files(self):
        with pytest.raises(Exception):
            RenderUploadRequest(
                files=[
                    FileInfo(filename="a.jpg", content_type="image/jpeg", size_bytes=100),
                    FileInfo(filename="b.jpg", content_type="image/jpeg", size_bytes=100),
                    FileInfo(filename="c.jpg", content_type="image/jpeg", size_bytes=100),
                ]
            )

    def test_upload_request_validates_content_type(self):
        with pytest.raises(Exception):
            RenderUploadRequest(
                files=[
                    FileInfo(filename="a.exe", content_type="application/exe", size_bytes=100),
                ]
            )

    def test_upload_request_validates_file_size(self):
        with pytest.raises(Exception):
            RenderUploadRequest(
                files=[
                    FileInfo(
                        filename="huge.jpg",
                        content_type="image/jpeg",
                        size_bytes=11 * 1024 * 1024,
                    ),
                ]
            )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec backend /app/.venv/bin/pytest tests/test_renders.py::TestRenderSchemas -v`
Expected: FAIL — `app.schemas.renders` doesn't exist

- [ ] **Step 3: Create schemas**

Create `backend/app/schemas/renders.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec backend /app/.venv/bin/pytest tests/test_renders.py::TestRenderSchemas -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/renders.py backend/tests/test_renders.py
git commit -m "feat: add Pydantic schemas for renders"
```

---

### Task 5: Render Service

**Files:**
- Create: `backend/app/services/renders.py`

- [ ] **Step 1: Write failing service tests**

Add to `backend/tests/test_renders.py`:

```python
from unittest.mock import MagicMock, patch

from app.models.render import Render, RenderStatus
from app.services import renders as render_service


class TestBuildRenderResponse:
    def test_builds_response_with_urls(self):
        render = MagicMock(spec=Render)
        render.id = uuid.uuid4()
        render.design_name = "Test"
        render.description = None
        render.status = RenderStatus.COMPLETED
        render.vehicle_photo_key = "org/renders/photo.jpg"
        render.wrap_design_key = "org/renders/design.png"
        render.result_image_key = "org/renders/result.jpg"
        render.share_token = None
        render.error_message = None
        render.work_order_id = None
        render.client_id = None
        render.vehicle_id = None
        render.created_by = uuid.uuid4()
        render.creator = MagicMock()
        render.creator.full_name = "Test User"
        render.creator.email = "test@test.com"
        render.created_at = "2026-03-11T00:00:00Z"
        render.updated_at = "2026-03-11T00:00:00Z"

        with patch("app.services.renders.generate_download_url") as mock_dl:
            mock_dl.side_effect = lambda key: f"https://r2.example.com/{key}"
            response = render_service.build_render_response(render)

        assert response.vehicle_photo_url == "https://r2.example.com/org/renders/photo.jpg"
        assert response.result_image_url == "https://r2.example.com/org/renders/result.jpg"
        assert response.created_by_name == "Test User"

    def test_uses_email_when_no_full_name(self):
        render = MagicMock(spec=Render)
        render.id = uuid.uuid4()
        render.design_name = "Test"
        render.description = None
        render.status = RenderStatus.PENDING
        render.vehicle_photo_key = "k1"
        render.wrap_design_key = "k2"
        render.result_image_key = None
        render.share_token = None
        render.error_message = None
        render.work_order_id = None
        render.client_id = None
        render.vehicle_id = None
        render.created_by = uuid.uuid4()
        render.creator = MagicMock()
        render.creator.full_name = None
        render.creator.email = "test@test.com"
        render.created_at = "2026-03-11T00:00:00Z"
        render.updated_at = "2026-03-11T00:00:00Z"

        with patch("app.services.renders.generate_download_url") as mock_dl:
            mock_dl.side_effect = lambda key: f"https://r2/{key}"
            response = render_service.build_render_response(render)

        assert response.created_by_name == "test@test.com"
        assert response.result_image_url is None


class TestBuildPrompt:
    def test_prompt_with_description(self):
        prompt = render_service.build_prompt("Full wrap, all panels")
        assert "Full wrap, all panels" in prompt
        assert "vehicle wrap design" in prompt.lower()

    def test_prompt_without_description(self):
        prompt = render_service.build_prompt(None)
        assert "vehicle wrap design" in prompt.lower()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec backend /app/.venv/bin/pytest tests/test_renders.py::TestBuildRenderResponse -v`
Expected: FAIL — `app.services.renders` doesn't exist

- [ ] **Step 3: Create render service**

Create `backend/app/services/renders.py`:

```python
import logging
import secrets
import uuid

from google import genai
from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.client import Client
from app.models.render import Render, RenderStatus
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.work_order import WorkOrder
from app.schemas.renders import RenderResponse
from app.services.r2 import (
    delete_object,
    download_object,
    generate_download_url,
    generate_object_key,
    upload_object,
)

logger = logging.getLogger("wrapiq")

RENDER_MODEL = "gemini-2.5-flash-image"


def build_prompt(description: str | None) -> str:
    base = (
        "Apply the vehicle wrap design (second image) onto the vehicle shown "
        "in the first image. The wrap should follow the vehicle's contours, "
        "match the lighting and perspective, and look realistic."
    )
    if description:
        return f"{base} {description}"
    return base


def build_render_response(render: Render) -> RenderResponse:
    creator_name = None
    if render.creator:
        creator_name = render.creator.full_name or render.creator.email

    return RenderResponse(
        id=render.id,
        design_name=render.design_name,
        description=render.description,
        status=render.status.value,
        vehicle_photo_url=generate_download_url(render.vehicle_photo_key),
        wrap_design_url=generate_download_url(render.wrap_design_key),
        result_image_url=(
            generate_download_url(render.result_image_key)
            if render.result_image_key
            else None
        ),
        share_token=render.share_token,
        error_message=render.error_message,
        work_order_id=render.work_order_id,
        client_id=render.client_id,
        vehicle_id=render.vehicle_id,
        created_by=render.created_by,
        created_by_name=creator_name,
        created_at=render.created_at,
        updated_at=render.updated_at,
    )


async def validate_ownership(
    session: AsyncSession,
    org_id: uuid.UUID,
    work_order_id: uuid.UUID | None,
    client_id: uuid.UUID | None,
    vehicle_id: uuid.UUID | None,
) -> None:
    if work_order_id:
        result = await session.execute(
            select(WorkOrder).where(
                WorkOrder.id == work_order_id,
                WorkOrder.organization_id == org_id,
            )
        )
        if not result.scalar_one_or_none():
            raise ValueError("Work order not found")

    if client_id:
        result = await session.execute(
            select(Client).where(
                Client.id == client_id,
                Client.organization_id == org_id,
            )
        )
        if not result.scalar_one_or_none():
            raise ValueError("Client not found")

    if vehicle_id:
        result = await session.execute(
            select(Vehicle).where(
                Vehicle.id == vehicle_id,
                Vehicle.organization_id == org_id,
            )
        )
        if not result.scalar_one_or_none():
            raise ValueError("Vehicle not found")


def _mime_type_from_key(key: str) -> str:
    """Infer MIME type from R2 object key extension."""
    lower = key.lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".pdf"):
        return "application/pdf"
    return "image/jpeg"


async def generate_image(
    vehicle_photo_key: str,
    wrap_design_key: str,
    description: str | None,
) -> bytes:
    if not settings.gemini_api_key:
        raise RuntimeError("AI features are not configured. Set GEMINI_API_KEY.")

    vehicle_photo = download_object(vehicle_photo_key)
    wrap_design = download_object(wrap_design_key)

    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = build_prompt(description)

    response = await client.aio.models.generate_content(
        model=RENDER_MODEL,
        contents=[
            types.Part.from_bytes(
                data=vehicle_photo,
                mime_type=_mime_type_from_key(vehicle_photo_key),
            ),
            types.Part.from_bytes(
                data=wrap_design,
                mime_type=_mime_type_from_key(wrap_design_key),
            ),
            prompt,
        ],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio="16:9"),
        ),
    )

    for part in response.parts:
        if part.inline_data:
            return part.inline_data.data

    raise RuntimeError("Gemini did not return an image")


async def create_render(
    session: AsyncSession,
    user: User,
    design_name: str,
    description: str | None,
    vehicle_photo_key: str,
    wrap_design_key: str,
    work_order_id: uuid.UUID | None,
    client_id: uuid.UUID | None,
    vehicle_id: uuid.UUID | None,
) -> Render:
    org_prefix = f"{user.organization_id}/"
    if not vehicle_photo_key.startswith(org_prefix):
        raise ValueError("Invalid vehicle photo key")
    if not wrap_design_key.startswith(org_prefix):
        raise ValueError("Invalid wrap design key")

    await validate_ownership(session, user.organization_id, work_order_id, client_id, vehicle_id)

    render = Render(
        organization_id=user.organization_id,
        design_name=design_name,
        description=description,
        vehicle_photo_key=vehicle_photo_key,
        wrap_design_key=wrap_design_key,
        work_order_id=work_order_id,
        client_id=client_id,
        vehicle_id=vehicle_id,
        created_by=user.id,
        status=RenderStatus.PENDING,
    )
    session.add(render)
    await session.flush()

    render.status = RenderStatus.RENDERING
    await session.flush()

    try:
        result_bytes = await generate_image(
            vehicle_photo_key, wrap_design_key, description
        )
        result_key = generate_object_key(
            user.organization_id, "result.jpg", prefix="renders"
        )
        upload_object(result_key, result_bytes, "image/jpeg")
        render.result_image_key = result_key
        render.status = RenderStatus.COMPLETED
    except Exception as exc:
        logger.exception("Render generation failed")
        render.status = RenderStatus.FAILED
        render.error_message = str(exc)[:500]

    await session.commit()
    await session.refresh(render)
    return render


async def list_renders(
    session: AsyncSession,
    org_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    status_filter: str | None = None,
    client_id: uuid.UUID | None = None,
    work_order_id: uuid.UUID | None = None,
    search: str | None = None,
) -> tuple[list[Render], int]:
    query = select(Render).where(Render.organization_id == org_id)
    count_query = (
        select(func.count())
        .select_from(Render)
        .where(Render.organization_id == org_id)
    )

    if status_filter:
        query = query.where(Render.status == status_filter)
        count_query = count_query.where(Render.status == status_filter)
    if client_id:
        query = query.where(Render.client_id == client_id)
        count_query = count_query.where(Render.client_id == client_id)
    if work_order_id:
        query = query.where(Render.work_order_id == work_order_id)
        count_query = count_query.where(Render.work_order_id == work_order_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(Render.design_name.ilike(pattern))
        count_query = count_query.where(Render.design_name.ilike(pattern))

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Render.created_at.desc()).offset(skip).limit(limit)
    result = await session.execute(query)
    items = list(result.scalars().all())

    return items, total


async def get_render(
    session: AsyncSession, render_id: uuid.UUID, org_id: uuid.UUID
) -> Render | None:
    result = await session.execute(
        select(Render).where(
            Render.id == render_id,
            Render.organization_id == org_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_render(
    session: AsyncSession, render: Render
) -> None:
    for key in [render.vehicle_photo_key, render.wrap_design_key, render.result_image_key]:
        if key:
            try:
                delete_object(key)
            except Exception:
                logger.warning("Failed to delete R2 object: %s", key)
    await session.delete(render)
    await session.commit()


async def regenerate_render(
    session: AsyncSession,
    render: Render,
    description: str | None = None,
) -> Render:
    if description is not None:
        render.description = description

    render.status = RenderStatus.RENDERING
    render.error_message = None
    await session.flush()

    try:
        result_bytes = await generate_image(
            render.vehicle_photo_key,
            render.wrap_design_key,
            render.description,
        )
        result_key = generate_object_key(
            render.organization_id, "result.jpg", prefix="renders"
        )
        # Delete old result if exists
        if render.result_image_key:
            try:
                delete_object(render.result_image_key)
            except Exception:
                pass
        upload_object(result_key, result_bytes, "image/jpeg")
        render.result_image_key = result_key
        render.status = RenderStatus.COMPLETED
    except Exception as exc:
        logger.exception("Render regeneration failed")
        render.status = RenderStatus.FAILED
        render.error_message = str(exc)[:500]

    await session.commit()
    await session.refresh(render)
    return render


async def generate_share_token(
    session: AsyncSession, render: Render
) -> str:
    if render.share_token:
        return render.share_token

    token = secrets.token_urlsafe(32)
    render.share_token = token
    await session.commit()
    await session.refresh(render)
    return token


async def get_render_by_share_token(
    session: AsyncSession, token: str
) -> Render | None:
    result = await session.execute(
        select(Render).where(Render.share_token == token)
    )
    return result.scalar_one_or_none()
```

- [ ] **Step 4: Add integration tests for service CRUD functions**

Add to `backend/tests/test_renders.py`:

```python
class TestMimeTypeFromKey:
    def test_jpeg(self):
        assert render_service._mime_type_from_key("org/renders/photo.jpg") == "image/jpeg"

    def test_png(self):
        assert render_service._mime_type_from_key("org/renders/design.png") == "image/png"

    def test_webp(self):
        assert render_service._mime_type_from_key("org/renders/photo.webp") == "image/webp"

    def test_pdf(self):
        assert render_service._mime_type_from_key("org/renders/design.pdf") == "application/pdf"

    def test_default_jpeg(self):
        assert render_service._mime_type_from_key("org/renders/unknown") == "image/jpeg"


class TestValidateOwnership:
    async def test_raises_for_wrong_org_work_order(self, db_session):
        org_id = uuid.uuid4()
        fake_wo_id = uuid.uuid4()
        with pytest.raises(ValueError, match="Work order not found"):
            await render_service.validate_ownership(
                db_session, org_id, work_order_id=fake_wo_id, client_id=None, vehicle_id=None
            )

    async def test_raises_for_wrong_org_client(self, db_session):
        org_id = uuid.uuid4()
        fake_client_id = uuid.uuid4()
        with pytest.raises(ValueError, match="Client not found"):
            await render_service.validate_ownership(
                db_session, org_id, work_order_id=None, client_id=fake_client_id, vehicle_id=None
            )

    async def test_passes_when_all_none(self, db_session):
        org_id = uuid.uuid4()
        # Should not raise
        await render_service.validate_ownership(
            db_session, org_id, work_order_id=None, client_id=None, vehicle_id=None
        )


class TestGenerateShareToken:
    async def test_generates_token(self, db_session, seed_plan):
        """Test that generate_share_token creates a token for a render."""
        # Register a user to get org_id
        from app.services.auth import AuthService
        auth = AuthService(db_session)
        await auth.register("share@test.com", "TestPass123", "Share Shop")

        from sqlalchemy import select
        from app.models.user import User
        result = await db_session.execute(select(User).where(User.email == "share@test.com"))
        user = result.scalar_one()

        from app.models.render import Render, RenderStatus
        render = Render(
            organization_id=user.organization_id,
            design_name="Test",
            vehicle_photo_key="k1",
            wrap_design_key="k2",
            status=RenderStatus.COMPLETED,
            created_by=user.id,
        )
        db_session.add(render)
        await db_session.commit()
        await db_session.refresh(render)

        token = await render_service.generate_share_token(db_session, render)
        assert token is not None
        assert len(token) > 20

    async def test_returns_existing_token(self, db_session, seed_plan):
        """Test that generate_share_token is idempotent."""
        from app.services.auth import AuthService
        auth = AuthService(db_session)
        await auth.register("idem@test.com", "TestPass123", "Idem Shop")

        from sqlalchemy import select
        from app.models.user import User
        result = await db_session.execute(select(User).where(User.email == "idem@test.com"))
        user = result.scalar_one()

        from app.models.render import Render, RenderStatus
        render = Render(
            organization_id=user.organization_id,
            design_name="Test",
            vehicle_photo_key="k1",
            wrap_design_key="k2",
            status=RenderStatus.COMPLETED,
            created_by=user.id,
            share_token="existing-token",
        )
        db_session.add(render)
        await db_session.commit()
        await db_session.refresh(render)

        token = await render_service.generate_share_token(db_session, render)
        assert token == "existing-token"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec backend /app/.venv/bin/pytest tests/test_renders.py -v -k "BuildRenderResponse or BuildPrompt or MimeType or ValidateOwnership or GenerateShareToken"`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/renders.py backend/tests/test_renders.py
git commit -m "feat: add render service with Gemini integration and CRUD functions"
```

---

### Task 6: Router + Wire Up

**Files:**
- Create: `backend/app/routers/renders.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write failing router tests**

Add to `backend/tests/test_renders.py`:

```python
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
from app.models.plan import Plan


@pytest.fixture
async def seed_plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.commit()
    return plan


@pytest.fixture
async def http_client(db_session, seed_plan):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _register(http_client) -> str:
    resp = await http_client.post(
        "/api/auth/register",
        json={
            "email": "staff@shop.com",
            "password": "TestPass123",
            "org_name": "Test Shop",
        },
    )
    return resp.json()["access_token"]


class TestRendersRouter:
    async def test_list_requires_auth(self, http_client):
        resp = await http_client.get("/api/renders")
        assert resp.status_code == 401

    async def test_list_empty(self, http_client):
        token = await _register(http_client)
        resp = await http_client.get(
            "/api/renders",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_get_nonexistent_returns_404(self, http_client):
        token = await _register(http_client)
        fake_id = str(uuid.uuid4())
        resp = await http_client.get(
            f"/api/renders/{fake_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_upload_urls_validates_content_type(self, http_client):
        token = await _register(http_client)
        resp = await http_client.post(
            "/api/renders/upload-urls",
            json={
                "files": [
                    {"filename": "bad.exe", "content_type": "application/exe", "size_bytes": 100}
                ]
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec backend /app/.venv/bin/pytest tests/test_renders.py::TestRendersRouter::test_list_requires_auth -v`
Expected: FAIL — 404 (router not registered)

- [ ] **Step 3: Create the router**

Create `backend/app/routers/renders.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.config import settings
from app.middleware.rate_limit import limiter
from app.models.render import RenderStatus
from app.models.user import User
from app.schemas.renders import (
    RenderCreate,
    RenderListResponse,
    RenderRegenerate,
    RenderResponse,
    RenderUploadRequest,
    RenderUploadResponse,
    ShareResponse,
    SharedRenderResponse,
    UploadInfo,
)
from app.services import renders as render_service
from app.services.r2 import (
    generate_download_url,
    generate_object_key,
    generate_upload_url,
    is_r2_configured,
)

router = APIRouter(prefix="/api/renders", tags=["renders"])


@router.post("/upload-urls", response_model=RenderUploadResponse)
async def get_upload_urls(
    body: RenderUploadRequest,
    user: User = Depends(get_current_user),
):
    if not is_r2_configured():
        raise HTTPException(status_code=503, detail="File uploads not configured")

    uploads = []
    for file_info in body.files:
        key = generate_object_key(
            user.organization_id, file_info.filename, prefix="renders"
        )
        url = generate_upload_url(key, file_info.content_type)
        uploads.append(UploadInfo(r2_key=key, upload_url=url))

    return RenderUploadResponse(uploads=uploads)


@router.post(
    "",
    response_model=RenderResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def create_render(
    request: Request,
    body: RenderCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    try:
        render = await render_service.create_render(
            session=session,
            user=user,
            design_name=body.design_name,
            description=body.description,
            vehicle_photo_key=body.vehicle_photo_key,
            wrap_design_key=body.wrap_design_key,
            work_order_id=body.work_order_id,
            client_id=body.client_id,
            vehicle_id=body.vehicle_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return render_service.build_render_response(render)


@router.get("", response_model=RenderListResponse)
async def list_renders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    client_id: uuid.UUID | None = Query(None),
    work_order_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None, max_length=200),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    items, total = await render_service.list_renders(
        session=session,
        org_id=user.organization_id,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
        client_id=client_id,
        work_order_id=work_order_id,
        search=search,
    )
    return RenderListResponse(
        items=[render_service.build_render_response(r) for r in items],
        total=total,
    )


@router.get("/shared/{token}", response_model=SharedRenderResponse)
async def get_shared_render(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    render = await render_service.get_render_by_share_token(session, token)
    if not render or render.status != RenderStatus.COMPLETED:
        raise HTTPException(status_code=404, detail="Render not found")

    return SharedRenderResponse(
        design_name=render.design_name,
        result_image_url=generate_download_url(render.result_image_key),
        created_at=render.created_at,
    )


@router.get("/{render_id}", response_model=RenderResponse)
async def get_render(
    render_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    render = await render_service.get_render(session, render_id, user.organization_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
    return render_service.build_render_response(render)


@router.delete("/{render_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_render(
    render_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    render = await render_service.get_render(session, render_id, user.organization_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
    await render_service.delete_render(session, render)


@router.post("/{render_id}/regenerate", response_model=RenderResponse)
@limiter.limit("5/minute")
async def regenerate_render(
    request: Request,
    render_id: uuid.UUID,
    body: RenderRegenerate | None = None,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    render = await render_service.get_render(session, render_id, user.organization_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")

    try:
        render = await render_service.regenerate_render(
            session, render, description=body.description if body else None
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return render_service.build_render_response(render)


@router.post("/{render_id}/share", response_model=ShareResponse)
async def share_render(
    render_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    render = await render_service.get_render(session, render_id, user.organization_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
    if render.status != RenderStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Render must be completed to share")

    token = await render_service.generate_share_token(session, render)
    share_url = f"{settings.frontend_url}/render/{token}"
    return ShareResponse(share_url=share_url)
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/app/main.py`:

After line 34 (`from app.routers.pay import router as pay_router`), add:
```python
from app.routers.renders import router as renders_router
```

After line 175 (`app.include_router(pay_router)`), add:
```python
app.include_router(renders_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec backend /app/.venv/bin/pytest tests/test_renders.py::TestRendersRouter -v`
Expected: All PASS

- [ ] **Step 6: Run full test suite**

Run: `make test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/renders.py backend/app/main.py backend/tests/test_renders.py
git commit -m "feat: add renders router with CRUD, share, and regenerate endpoints"
```

---

## Chunk 3: Frontend

### Task 7: Replace 3D Rendering Page

**Files:**
- Modify: `frontend/src/app/dashboard/3d/page.tsx` (complete rewrite)

- [ ] **Step 1: Rewrite the 3D page**

Replace the entire contents of `frontend/src/app/dashboard/3d/page.tsx` with a real API-connected page.

The page should include:
- State: `renders`, `total`, `loading`, `error`, `filter` (status), `viewMode` (grid/table), `showNewRender`, `toast`, `page` (pagination)
- `fetchRenders` using `api.get<RenderListResponse>('/api/renders?...')` with useCallback + useEffect pattern
- Filter tabs: All, Rendering, Completed, Failed
- View toggle: grid (default) / table with icon buttons
- Grid view: cards with result image (or placeholder), design name, status badge, date
- Table view: thumbnail + columns (design, client, vehicle, status, date, share)
- Share button on completed renders (calls `POST /api/renders/{id}/share`, copies URL to clipboard)
- Delete button with confirmation
- Regenerate button
- **Pagination**: Previous/Next buttons with "Showing X-Y of Z" text (matching work-orders page pattern)
- Loading skeleton, empty state, error state
- Toast for success messages

Key patterns to follow (from `frontend/src/app/dashboard/work-orders/page.tsx`):
- `useCallback` for fetch functions
- `useEffect` with dependency on fetch function
- `page` state with `skip = page * limit` calculation
- `api.get` / `api.post` / `api.delete` from `@/lib/api-client`
- `ApiError` instanceof checks for error messages
- Inline interface definitions for API response types

```typescript
// Key interfaces to define at top of file:
interface RenderResponse {
  id: string;
  design_name: string;
  description: string | null;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  vehicle_photo_url: string;
  wrap_design_url: string;
  result_image_url: string | null;
  share_token: string | null;
  error_message: string | null;
  work_order_id: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface RenderListResponse {
  items: RenderResponse[];
  total: number;
}
```

- [ ] **Step 2: Verify page renders**

Run: `cd frontend && npm run build` (or check in browser at `http://localhost:3000/dashboard/3d`)
Expected: Page loads with empty state (no renders yet)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboard/3d/page.tsx
git commit -m "feat: replace mock 3D rendering page with real API integration"
```

---

### Task 8: New Render Modal

**Files:**
- Create: `frontend/src/components/renders/NewRenderModal.tsx`
- Modify: `frontend/src/app/dashboard/3d/page.tsx` (import and use modal)

- [ ] **Step 1: Create NewRenderModal component**

Create `frontend/src/components/renders/NewRenderModal.tsx` as a separate component file (matching the `CreateWorkOrderModal` pattern in `frontend/src/components/work-orders/CreateWorkOrderModal.tsx`).

**Props interface:**
```typescript
interface NewRenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;  // callback to trigger parent refetch
}
```

The modal MUST:
- Use `useModalAccessibility(isOpen, onClose)` hook for focus trapping, Escape key handling, and focus restoration (import from `@/hooks/useModalAccessibility`)
- Attach the returned ref to the modal container `div`

**Form fields:**
- Design name (text input, required)
- Vehicle photo (file input with drag-and-drop, required)
- Wrap design file (file input with drag-and-drop, required)
- Client (dropdown, optional — lazy-fetched from `/api/clients?limit=100` on modal open)
- Vehicle (dropdown, optional — lazy-fetched from `/api/vehicles?limit=100` on modal open)
- Work order (dropdown, optional — lazy-fetched from `/api/work-orders?limit=100` on modal open)
- Notes/instructions (textarea, optional)

**Client-side file validation (before upload):**
- Vehicle photo: accept `image/jpeg`, `image/png`, `image/webp` only, max 10 MB
- Wrap design: accept `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, max 10 MB
- Show inline error if validation fails

**Upload flow — IMPORTANT: Use native `fetch()` for R2 uploads, NOT `api.post` or `apiFetch`:**
The `apiFetch` function JSON-stringifies the body (corrupts binary data) and injects an Authorization header (causes R2 presigned URL signature mismatch). R2 uploads MUST use raw `fetch()`.

```typescript
// 1. Get presigned URLs
const uploadRes = await api.post<RenderUploadResponse>('/api/renders/upload-urls', {
  files: [
    { filename: vehicleFile.name, content_type: vehicleFile.type, size_bytes: vehicleFile.size },
    { filename: designFile.name, content_type: designFile.type, size_bytes: designFile.size },
  ],
});

// 2. Upload to R2 using native fetch (NOT apiFetch!)
await fetch(uploadRes.uploads[0].upload_url, {
  method: 'PUT',
  body: vehicleFile,
  headers: { 'Content-Type': vehicleFile.type },
});
await fetch(uploadRes.uploads[1].upload_url, {
  method: 'PUT',
  body: designFile,
  headers: { 'Content-Type': designFile.type },
});

// 3. Create render
await api.post('/api/renders', {
  design_name: designName,
  description: notes || undefined,
  vehicle_photo_key: uploadRes.uploads[0].r2_key,
  wrap_design_key: uploadRes.uploads[1].r2_key,
  client_id: clientId || undefined,
  vehicle_id: vehicleId || undefined,
  work_order_id: workOrderId || undefined,
});
```

**Progress states:** "Uploading files..." → "Generating render..." (switch after R2 uploads complete)
**On success:** call `onCreate()`, then `onClose()`, parent shows toast
**On error:** show inline error message via `ApiError` instanceof check

- [ ] **Step 2: Import and use modal in page.tsx**

In `frontend/src/app/dashboard/3d/page.tsx`, import and render:
```typescript
import NewRenderModal from '@/components/renders/NewRenderModal';

// In the page component:
<NewRenderModal
  isOpen={showNewRender}
  onClose={() => setShowNewRender(false)}
  onCreate={() => { fetchRenders(); showToast('Render created successfully'); }}
/>
```

- [ ] **Step 3: Test modal in browser**

Open `http://localhost:3000/dashboard/3d`, click "+ New Render", verify form renders correctly
Expected: Modal opens with all fields, Escape key closes, dropdowns load data

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/renders/NewRenderModal.tsx frontend/src/app/dashboard/3d/page.tsx
git commit -m "feat: add NewRenderModal with R2 upload and Gemini generation"
```

---

### Task 9: Shared Render Page

**Files:**
- Create: `frontend/src/app/render/[token]/page.tsx`

- [ ] **Step 1: Create the shared render page**

Create `frontend/src/app/render/[token]/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface SharedRender {
  design_name: string;
  result_image_url: string;
  created_at: string;
}

export default function SharedRenderPage() {
  const params = useParams();
  const token = params.token as string;
  const [render, setRender] = useState<SharedRender | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use raw fetch() instead of apiFetch — this is a public page.
  // apiFetch would inject Authorization headers and trigger redirect-to-login
  // on 401 if a logged-in user's token has expired.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/renders/shared/${token}`);
        if (!res.ok) throw new Error('Render not found');
        const data: SharedRender = await res.json();
        setRender(data);
      } catch {
        setError('Render not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f4f6]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !render) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f4f6]">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#18181b]">
          <span className="font-mono text-sm font-bold text-white">WF</span>
        </div>
        <h1 className="text-lg font-semibold text-[#18181b]">Render Not Found</h1>
        <p className="mt-1 text-sm text-[#60606a]">{error || 'This render may have been deleted.'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f4f4f6] px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18181b]">
          <span className="font-mono text-xs font-bold text-white">WF</span>
        </div>
        <span className="text-sm font-medium text-[#60606a]">
          Wrap<span className="text-blue-600">Flow</span>
        </span>
      </div>

      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#e6e6eb] bg-white shadow-sm">
        <img
          src={render.result_image_url}
          alt={render.design_name}
          className="w-full object-contain"
        />
        <div className="border-t border-[#e6e6eb] px-6 py-4">
          <h1 className="text-lg font-semibold text-[#18181b]">{render.design_name}</h1>
          <p className="mt-1 text-sm text-[#a8a8b4]">
            Created {new Date(render.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify page builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/render/[token]/page.tsx
git commit -m "feat: add public shared render page"
```

---

## Chunk 4: Lint, Full Test, Final Commit

### Task 10: Lint + Format + Final Verification

- [ ] **Step 1: Run backend linting**

Run: `make lint-fix`
Expected: All files formatted, no errors

- [ ] **Step 2: Run backend tests**

Run: `make test`
Expected: All tests pass

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Fix any lint/test/build issues**

Address any failures from steps 1-3.

- [ ] **Step 5: Final commit if any fixes needed**

Stage only the specific files that were changed by lint/format fixes, then commit:
```bash
git commit -m "fix: lint and formatting fixes for renders feature"
```
