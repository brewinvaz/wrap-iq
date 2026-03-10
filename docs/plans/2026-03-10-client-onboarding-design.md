# Client Self-Service Onboarding Design

## Overview

Admin-invited client onboarding for WrapFlow.io. Admins send an invite email, clients fill out a branded form with their info, vehicle details, and reference files, and submission creates a User + Vehicle + WorkOrder in LEAD status.

**Related issues:** #34 (Client self-service onboarding)

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry point | Admin invite link | Prevents spam/abuse, shop controls who onboards |
| Client info storage | UserProfile table (1:1 with User) | Avoids bloating User, clean separation |
| File storage | Cloudflare R2 via presigned URLs | Scalable, no file data through API server |
| Work order creation | Auto-create in LEAD status | Uses existing KanbanStage LEAD, no extra review queue |
| Onboarding auth | Invite token (no JWT) | Client has no account yet during form fill |
| Post-submission access | Magic link email | Client gets portal access without setting a password |

## Data Models

### ClientInvite (new, org-scoped)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK, TenantMixin |
| email | str | Client's email |
| token | str | Unique, `secrets.token_urlsafe(32)` |
| invited_by | UUID | FK to users (admin who invited) |
| expires_at | datetime | 7 days from creation |
| accepted_at | datetime? | Null until used |

### UserProfile (new, 1:1 with User)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK to users, unique |
| first_name | str? | |
| last_name | str? | |
| phone | str? | |
| company_name | str? | |
| address | str? | Free-form text |

### FileUpload (new, org-scoped)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| organization_id | UUID | FK, TenantMixin |
| uploaded_by | UUID | FK to users |
| work_order_id | UUID? | FK to work_orders, nullable |
| r2_key | str | Object key in R2 bucket |
| filename | str | Original filename |
| content_type | str | MIME type |
| size_bytes | int | File size |

## API Endpoints

### Admin — invite client

```
POST /api/admin/client-invites         # Send invite email
  Body: { email: str }
GET  /api/admin/client-invites         # List invites (pending/accepted)
```

### Client onboarding (token-authenticated)

```
GET  /api/portal/onboarding/{token}                  # Validate invite, return org info
POST /api/portal/onboarding/{token}/vin/{vin}        # VIN decode (no JWT needed)
POST /api/portal/onboarding/{token}/upload-url        # Get presigned R2 upload URL
  Body: { filename, content_type }
POST /api/portal/onboarding/{token}/submit            # Submit onboarding form
  Body: {
    first_name, last_name, phone, company_name, address,
    vehicle: { vin?, year?, make?, model?, vehicle_type? },
    job_type, wrap_coverage?, project_description,
    file_keys: [{ r2_key, filename, content_type, size_bytes }],
    referral_source?
  }
```

### Submission creates (single transaction)

1. User with `role=CLIENT`, `password_hash=None` (magic-link-only)
2. UserProfile with contact details
3. Vehicle (with VIN auto-populated fields if available)
4. WorkOrder in LEAD status (first KanbanStage with `system_status=LEAD`)
5. WorkOrderVehicle junction
6. FileUpload records for each uploaded file
7. Sends magic link email for portal access
8. Marks invite as accepted

## R2 Integration

### Config (new env vars)

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL          # Optional, for serving files
```

### R2 Service

- `boto3` with S3-compatible endpoint: `https://{account_id}.r2.cloudflarestorage.com`
- `generate_upload_url(key, content_type, max_size_mb=10)` → presigned PUT URL (15 min expiry)
- `generate_download_url(key)` → presigned GET URL (1 hour expiry)
- `delete_object(key)` → cleanup

### Object key format

`{org_id}/onboarding/{work_order_id}/{uuid}_{filename}`

### Constraints

- Max file size: 10MB per file
- Max files per submission: 5
- Allowed types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`

## Security

- Invite tokens: 7-day expiry, single-use (marked `accepted_at` on submit)
- Expired/used tokens return 410 Gone
- If email already has a User in the org, skip user creation, just create work order
- Presigned URLs scoped to specific key + content type
- R2 keys validated to match org namespace at submission (prevent path traversal)
- Same email invited twice: latest invite wins, old one still works until expiry
- Entire submission is one DB transaction — all or nothing

## New Dependencies

- `boto3` — S3-compatible client for R2 presigned URLs
