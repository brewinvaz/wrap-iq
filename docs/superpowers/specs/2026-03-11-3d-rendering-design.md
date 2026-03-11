# 3D Rendering Feature — Design Spec

## Overview

Replace the mock 3D Rendering page with a real feature that lets staff generate AI-powered wrap visualizations. Staff upload a vehicle photo and wrap design file, the system uses Google Gemini to composite them, and the result can be shared with clients via a public link.

## Goals

- Staff can create render requests with vehicle photo + wrap design + metadata
- AI generates a composite image showing the wrap on the vehicle
- Staff can review, re-generate, and share results with clients
- Renders are optionally linked to work orders, clients, and vehicles
- Tenant-isolated (organization_id on all data)

## Non-Goals

- Client-initiated renders (cost control — staff only)
- Approval workflows or revision tracking
- Real-time 3D manipulation in the browser
- Background task queue (generation completes in seconds, inline call is sufficient)

## AI Integration

### Approach: Gemini `generate_content` with Image Output

Use `gemini-2.5-flash-image` model via the existing `google-genai` SDK. This model accepts multiple images as input and generates images as output through the Developer API (API key auth — already configured).

**Why not Imagen `edit_image`:** The `edit_image` API with `StyleReferenceImage` would be ideal for this use case, but it requires Vertex AI (GCP project + service account credentials). The project uses Gemini Developer API with an API key. Gemini's multimodal `generate_content` achieves the same result without changing auth infrastructure.

**API call:**
```python
from google.genai import types

response = await client.aio.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[
        types.Part.from_image(vehicle_photo_image),
        types.Part.from_image(wrap_design_image),
        f"Apply the vehicle wrap design (second image) onto the vehicle shown "
        f"in the first image. The wrap should follow the vehicle's contours, "
        f"match the lighting and perspective, and look realistic. "
        f"{description or ''}",
    ],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9"),
    ),
)

# Extract generated image from response
for part in response.parts:
    if part.inline_data:
        result_image = part.inline_data
```

**Error handling:** If the API fails (rate limit, content filter, network error), set render status to `failed` with the error message. Staff can retry via the regenerate endpoint.

## Data Model

### New table: `renders`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `organization_id` | UUID, FK → organizations | NOT NULL (TenantMixin) |
| `work_order_id` | UUID, FK → work_orders | nullable |
| `client_id` | UUID, FK → clients | nullable |
| `vehicle_id` | UUID, FK → vehicles | nullable |
| `design_name` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | nullable — AI instructions (e.g., "full wrap, driver side only") |
| `status` | ENUM: pending, rendering, completed, failed | NOT NULL, default: pending |
| `vehicle_photo_key` | VARCHAR(500) | NOT NULL — R2 object key |
| `wrap_design_key` | VARCHAR(500) | NOT NULL — R2 object key |
| `result_image_key` | VARCHAR(500) | nullable — R2 object key |
| `share_token` | VARCHAR(64) | nullable, unique |
| `error_message` | TEXT | nullable |
| `created_by` | UUID, FK → users | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL, server default |
| `updated_at` | TIMESTAMPTZ | NOT NULL, server default + onupdate |

**Storage:** Columns store R2 object keys (not URLs). Presigned download URLs are generated at response time via `r2.generate_download_url(key)`. This avoids expiring URLs in the database and simplifies deletion (key is already available).

**Indexes:**
- `ix_renders_organization_id` on `organization_id`
- `ix_renders_work_order_id` on `work_order_id`
- `ix_renders_client_id` on `client_id`
- `ix_renders_share_token` unique on `share_token`
- `ix_renders_created_by` on `created_by`

**Mixins:** TenantMixin + TimestampMixin (following existing pattern)

## File Upload Strategy

### Two-step presigned URL flow (matching existing R2 pattern)

The existing R2 service uses presigned URLs — the frontend uploads directly to R2, then sends the object key to the backend. This avoids the 10 MB body size limit in `main.py` middleware and keeps large files off the backend server.

**Flow:**
1. Frontend requests presigned upload URLs: `POST /api/renders/upload-urls` with filenames + content types
2. Frontend uploads vehicle photo and wrap design directly to R2 using the presigned PUT URLs
3. Frontend submits the render form with R2 object keys (not files): `POST /api/renders`
4. Backend validates the keys belong to the org namespace (existing `r2.validate_file_keys` pattern)

### Constraints

- **Vehicle photo:** image/jpeg, image/png, image/webp — max 10 MB
- **Wrap design:** image/jpeg, image/png, image/webp, application/pdf — max 10 MB
- Validated using existing `ALLOWED_CONTENT_TYPES` and `MAX_FILE_SIZE_MB` from `r2.py`

### R2 service additions

Add `upload_object(key, data, content_type)` to `r2.py` for the backend to upload AI-generated result images to R2. The vehicle photo and wrap design are uploaded by the frontend via presigned URLs, but the generated result must be uploaded server-side.

**R2 key format:** `{org_id}/renders/{unique_id}_{filename}`

## API Endpoints

All endpoints under `/api/renders`, auth required (except shared view).

### POST /api/renders/upload-urls
Generate presigned upload URLs for vehicle photo and wrap design.

**Request body:**
```json
{
  "files": [
    { "filename": "vehicle.jpg", "content_type": "image/jpeg", "size_bytes": 2048000 },
    { "filename": "design.png", "content_type": "image/png", "size_bytes": 5120000 }
  ]
}
```

**Validation:** content type in allowed list, size ≤ 10 MB per file, max 2 files.

**Response:** 200
```json
{
  "uploads": [
    { "r2_key": "org-id/renders/abc123_vehicle.jpg", "upload_url": "https://..." },
    { "r2_key": "org-id/renders/def456_design.png", "upload_url": "https://..." }
  ]
}
```

### POST /api/renders
Create a render and trigger AI generation.

**Request body (JSON, not multipart):**
```json
{
  "design_name": "Fleet Branding v2",
  "description": "Full wrap, all panels",
  "vehicle_photo_key": "org-id/renders/abc123_vehicle.jpg",
  "wrap_design_key": "org-id/renders/def456_design.png",
  "work_order_id": null,
  "client_id": "uuid",
  "vehicle_id": null
}
```

**Flow:**
1. Validate R2 keys belong to org namespace
2. Validate work_order_id, client_id, vehicle_id ownership (if provided) — same pattern as `work_orders.py` ownership validation
3. Create render record with `status=pending`
4. Set `status=rendering`
5. Download vehicle photo and wrap design from R2
6. Call Gemini `generate_content` with both images + prompt
7. On success: upload result to R2 via `upload_object()`, set `status=completed` + `result_image_key`
8. On failure: set `status=failed` + `error_message`
9. Commit and return render

**Failure handling:**
- Step 1-2 failure: return HTTP 400/404 before creating DB record
- Step 6 failure (Gemini): set status=failed, keep uploaded files for retry
- Step 7 failure (R2 result upload): set status=failed with message, staff can regenerate

**Response:** 201, RenderResponse

### GET /api/renders
List renders with pagination and filtering.

**Query params:**
- `skip` (int, default 0)
- `limit` (int, default 50, max 100)
- `status` (string, optional — filter by status enum value)
- `client_id` (UUID, optional)
- `work_order_id` (UUID, optional)
- `search` (string, optional — search design_name)

**Response:** 200, `{ items: RenderResponse[], total: int }`

### GET /api/renders/{id}
Get a single render by ID.

**Response:** 200, RenderResponse (or 404)

### DELETE /api/renders/{id}
Delete a render and its R2 files (vehicle photo key, wrap design key, result image key).

**Response:** 204

### POST /api/renders/{id}/regenerate
Re-generate with same inputs. Optionally accepts updated description.

**Request body:** `{ "description": "updated instructions" }` (optional)

**Flow:** Same as create steps 4-9 but reuses existing R2 files. Sets status back to rendering → completed/failed.

**Response:** 200, RenderResponse

### POST /api/renders/{id}/share
Generate a share_token for the render (must be status=completed).

**Token generation:** `secrets.token_urlsafe(32)` — same pattern as magic links.
**Idempotent:** If share_token already exists, return the existing one.

**Response:** 200, `{ "share_url": "https://{frontend_url}/render/{token}" }`

### GET /api/renders/shared/{token}
Public endpoint (no auth). Returns render details for client viewing.

Generates a fresh presigned download URL for the result image each time (1 hour expiry).

**Response:** 200, `{ "design_name": str, "result_image_url": str, "created_at": str }`

## Rate Limiting

Apply slowapi rate limits to AI-calling endpoints:
- `POST /api/renders` — `5/minute` per user
- `POST /api/renders/{id}/regenerate` — `5/minute` per user

## Schemas

### RenderCreate (Pydantic BaseModel)
- `design_name: str` — Field(min_length=1, max_length=255)
- `description: str | None` — optional
- `vehicle_photo_key: str` — required
- `wrap_design_key: str` — required
- `work_order_id: UUID | None`
- `client_id: UUID | None`
- `vehicle_id: UUID | None`

### RenderRegenerate (Pydantic BaseModel)
- `description: str | None`

### RenderResponse
- `id: UUID`
- `design_name: str`
- `description: str | None`
- `status: str`
- `vehicle_photo_url: str` — presigned download URL, generated at response time
- `wrap_design_url: str` — presigned download URL, generated at response time
- `result_image_url: str | None` — presigned download URL if completed
- `share_token: str | None`
- `error_message: str | None`
- `work_order_id: UUID | None`
- `client_id: UUID | None`
- `vehicle_id: UUID | None`
- `created_by: UUID`
- `created_by_name: str | None` — user's full_name or email for display
- `created_at: datetime`
- `updated_at: datetime`

Note: `model_config = {"from_attributes": True}` does not apply here since we transform R2 keys → presigned URLs at serialization time. Build response dict manually in the router/service.

### RenderListResponse
- `items: list[RenderResponse]`
- `total: int`

### SharedRenderResponse
- `design_name: str`
- `result_image_url: str`
- `created_at: datetime`

### RenderUploadRequest / RenderUploadResponse
- Request: `files: list[FileInfo]` where FileInfo has filename, content_type, size_bytes
- Response: `uploads: list[UploadInfo]` where UploadInfo has r2_key, upload_url

## Frontend

### Page: `/dashboard/3d/page.tsx`

Replace existing mock page entirely.

**Layout:**
- Header with title, render count badge, view toggle (grid/table icons), and "+ New Render" button
- Filter tabs: All, Rendering, Completed, Failed
- Default view: **grid** of cards with image previews (result image if completed, placeholder if pending/rendering)
- Toggle to **table** view with thumbnail + columns (design, client, vehicle, status, date, share action)
- Share button on completed renders — copies link to clipboard, shows toast
- Regenerate and Delete actions on each render

**Data fetching:** `api.get<RenderListResponse>('/api/renders?limit=50')` with status/search filtering, following work orders page pattern (useCallback + useEffect, skip/limit pagination).

**Loading state:** Skeleton matching grid layout (pulse animation).
**Empty state:** "No renders yet" with prompt to create first render.
**Error state:** Error message with retry button.

### New Render Modal

Standard form modal (matches CreateWorkOrderModal pattern):
- Design name (text input, required)
- Vehicle photo (file input with drag-and-drop, required)
- Wrap design file (file input with drag-and-drop, required)
- Client (dropdown, optional — fetched from `/api/clients?limit=100`)
- Vehicle (dropdown, optional — fetched from `/api/vehicles?limit=100`)
- Work order (dropdown, optional — fetched from `/api/work-orders?limit=100`)
- Notes/instructions (textarea, optional)

**Upload flow:**
1. User selects files
2. On submit: request presigned URLs → upload files to R2 → submit render creation
3. Show progress indicator during upload + generation
4. On success: close modal, refetch list, show toast

### Shared Render Page: `/render/[token]/page.tsx`

Public page (outside dashboard/auth guard) that displays a shared render result.
- Fetches from `GET /api/renders/shared/{token}`
- Shows design name, rendered image, and creation date
- Minimal branding (WrapFlow logo)

## Migration

**File:** `014_create_renders_table.py`
**Down revision:** `06a40acd1a7c` (current single head — merge migration)

Creates the `renders` table with all columns, indexes, and the `renderstatus` enum.

## Files to Create/Modify

### New files:
- `backend/app/models/render.py` — SQLAlchemy model with TenantMixin + TimestampMixin
- `backend/app/schemas/renders.py` — Pydantic schemas
- `backend/app/services/renders.py` — module-level async functions (create, list, get, delete, regenerate, share, generate_image)
- `backend/app/routers/renders.py` — API endpoints
- `backend/alembic/versions/014_create_renders_table.py` — migration
- `backend/tests/test_renders.py` — backend tests
- `frontend/src/app/render/[token]/page.tsx` — public shared render page

### Modified files:
- `backend/app/models/__init__.py` — register Render model
- `backend/app/main.py` — import and include renders router
- `backend/app/services/r2.py` — add `upload_object()` function and `generate_render_key()` helper
- `frontend/src/app/dashboard/3d/page.tsx` — replace mock page entirely

## Testing

### Backend tests (pytest, asyncio_mode="auto"):
- **Model:** render creation, status enum values, org isolation
- **Schema:** required field validation, enum validation
- **Service:** create (mock R2 + Gemini), list with filters, get, delete, regenerate, share token generation
- **Router:** all endpoints, auth required, org filtering, 404 handling, ownership validation for optional FKs
- **Gemini integration:** mock google-genai calls, test success + failure paths, prompt construction
- **R2:** test `upload_object()`, test `generate_render_key()` format
