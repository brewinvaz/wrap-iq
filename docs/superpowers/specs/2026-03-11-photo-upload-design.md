# Photo Upload for Work Orders

## Overview

Add photo upload functionality to the project detail Photos tab. Users can upload photos (PNG, JPG, WebP up to 10MB) directly to Cloudflare R2 via presigned URLs, then categorize them as Before, After, or leave Uncategorized.

## Architecture

**Pattern**: Presigned URL upload — mirrors the existing onboarding upload flow.

**Flow**:
1. Frontend requests presigned PUT URL per file from backend
2. Frontend uploads directly to R2 using presigned URL
3. Frontend registers uploaded files with backend (sends file metadata array)
4. Backend validates and creates `FileUpload` records linked to the work order
5. Photos appear in Uncategorized section; user assigns categories via inline controls

## Data Model

### FileUpload Changes

Add column to existing `FileUpload` model (`backend/app/models/file_upload.py`):

| Column | Type | Description |
|---|---|---|
| `photo_type` | `String(20)`, nullable | `before`, `after`, or `null` (uncategorized) |
| `caption` | `String(500)`, nullable | Optional photo caption |

New Alembic migration required. The existing `before_photos` / `after_photos` JSONB columns on `WorkOrder` are not modified (legacy, unused going forward).

## API Endpoints

All endpoints require authentication and tenant scoping. The authenticated user's `org_id` is used for tenant isolation, and their `user_id` is used for `uploaded_by`. Work order access is verified via existing tenant middleware (user must belong to the org that owns the work order).

**R2 availability**: All photo endpoints must check `settings.r2_account_id` is configured before proceeding. Return HTTP 503 with `{"detail": "File storage not configured"}` if R2 is unavailable (matches onboarding pattern).

### `POST /api/work-orders/{work_order_id}/photos/upload-url`

Request presigned upload URL.

**Request body**:
```json
{
  "filename": "front-bumper.jpg",
  "content_type": "image/jpeg"
}
```

**Response** (200):
```json
{
  "upload_url": "https://r2.example.com/...",
  "r2_key": "org-123/photos/abc_front-bumper.jpg"
}
```

**Validation**:
- `content_type` must be in `image/jpeg`, `image/png`, `image/webp` (photo-specific check — the R2 service also allows `application/pdf` but the photo router must reject it)
- `filename` sanitized via existing `generate_object_key` with `prefix="photos"` (produces keys like `org-123/photos/abc_front-bumper.jpg`)

### `POST /api/work-orders/{work_order_id}/photos`

Register uploaded photos after R2 upload completes.

**Request body**:
```json
{
  "files": [
    {
      "r2_key": "org-123/photos/abc_front-bumper.jpg",
      "filename": "front-bumper.jpg",
      "content_type": "image/jpeg",
      "size_bytes": 245000
    }
  ]
}
```

**Response** (201): Array of created `FileUpload` records.

**Validation**:
- Max 5 files per request (matches R2 service config)
- Each file validated via existing `validate_file_keys` (org ownership, content type, size)
- Additional image-only content type check (reject PDFs that pass R2 validation)
- `work_order_id` set from URL path parameter; `uploaded_by` set from authenticated user's JWT

### `GET /api/work-orders/{work_order_id}/photos`

List all photos for a work order.

**Response** (200):
```json
{
  "photos": [
    {
      "id": "uuid",
      "filename": "front-bumper.jpg",
      "content_type": "image/jpeg",
      "size_bytes": 245000,
      "photo_type": null,
      "caption": null,
      "url": "https://r2.example.com/signed-url...",
      "created_at": "2026-03-11T..."
    }
  ]
}
```

Each photo URL is a presigned GET URL (1-hour expiry) generated via existing `generate_download_url`.

### `PATCH /api/work-orders/{work_order_id}/photos/{photo_id}`

Update photo metadata (category, caption).

**Request body**:
```json
{
  "photo_type": "before",
  "caption": "Front bumper before wrap"
}
```

**Response** (200): Updated `FileUpload` record.

### `DELETE /api/work-orders/{work_order_id}/photos/{photo_id}`

Delete a photo.

**Behavior**:
- Delete from R2 via existing `delete_object` (hard delete — R2 `delete_object` is permanent)
- Hard-delete `FileUpload` record from DB

**Response** (204): No content.

## Frontend Design

### Upload Zone

Replace the current placeholder `<div>` in `PhotosTab` (`frontend/src/app/dashboard/projects/[id]/page.tsx`) with a functional upload component:

- Hidden `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`
- Click on zone triggers file input
- Drag-and-drop support via `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` events
- Visual feedback: border color change on drag hover
- Max 5 files per batch, max 10MB per file — validate client-side before upload
- Update placeholder text to "PNG, JPG, WebP up to 10MB"

### Upload Progress

- Per-file progress bar using XHR `upload.onprogress` (fetch doesn't support upload progress)
- States: uploading → registering → done / error
- Error display per file (e.g., "File too large", "Upload failed")
- Retry button on failed uploads

### Photo Display

Three sections in order:
1. **Before** — photos with `photo_type === 'before'`
2. **After** — photos with `photo_type === 'after'`
3. **Uncategorized** — photos with `photo_type === null`

Each photo card:
- Thumbnail image (from presigned URL)
- Filename
- Category selector (dropdown or segmented control): Before / After / Uncategorized
- Caption field (inline editable, debounced save)
- Delete button with confirmation

### State Management

- Photos fetched via `GET /photos` on tab load
- Upload state managed locally in component (`useState`)
- Optimistic UI updates for category changes and deletes
- Refetch photo list after successful upload batch

### Types

Update `frontend/src/lib/types.ts`:

```typescript
interface WorkOrderPhoto {
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

The existing `ProjectPhoto` type will be updated to support null type for uncategorized photos:

```typescript
interface ProjectPhoto {
  url: string;
  type: 'before' | 'after' | null;  // null = uncategorized
  caption?: string;
}
```

The `transformWorkOrderToProject` function will map `WorkOrderPhoto.photo_type` → `ProjectPhoto.type`. The `PhotosTab` filter logic already handles this since `p.type === 'before'` naturally excludes null values. A third "Uncategorized" section will filter for `p.type === null`.

## File Changes Summary

### Backend (new/modified)
- `backend/app/models/file_upload.py` — add `photo_type`, `caption` columns
- `backend/app/schemas/work_order_photos.py` — new schema file for request/response models
- `backend/app/routers/work_order_photos.py` — new router with all photo endpoints
- `backend/app/main.py` — register new router
- New Alembic migration for `photo_type` and `caption` columns

### Frontend (modified)
- `frontend/src/lib/types.ts` — add `WorkOrderPhoto` type
- `frontend/src/app/dashboard/projects/[id]/page.tsx` — replace placeholder with functional upload component, update `PhotosTab` and `PhotoGrid`

## Constraints

- File types: `image/jpeg`, `image/png`, `image/webp` only
- Max file size: 10MB (enforced client-side and via R2 service)
- Max files per upload batch: 5
- Presigned upload URLs expire after 15 minutes
- Presigned download URLs expire after 1 hour
- All endpoints tenant-scoped (existing middleware)

## Testing

### Backend
- Unit tests for photo router endpoints (upload-url, register, list, update, delete)
- Validation tests (wrong content type, oversized file, wrong org)
- Integration test for presigned URL generation

### Frontend
- Component renders upload zone
- File validation (type, size, count)
- Upload flow triggers correct API calls in sequence
- Category changes call PATCH endpoint
- Delete calls DELETE endpoint with confirmation
