# ARQ Worker Jobs — Emails & Rendering Pipeline

**Issue:** #471 (partial — emails and rendering only)
**Date:** 2026-03-13
**Status:** Approved

## Problem

The ARQ worker service (`wrapiq-worker`) runs but only has a placeholder `ping` task. Render generation and email sending run synchronously in HTTP request handlers, blocking responses and risking timeouts.

## Scope

This spec covers migrating two operations to ARQ background jobs:

1. **Render generation** (high priority) — Gemini API calls + R2 uploads block POST `/api/renders` for seconds to minutes
2. **Email sending** (medium priority) — Resend API calls block auth/onboarding endpoints

Out of scope: webhook dispatch, notification delivery (future sub-issues of #471).

## Design

### Approach: Split sync (API-facing) and async (worker-facing)

Services handle request-scoped work (create DB records, enqueue jobs, return responses). Worker tasks handle background work (call external APIs, upload files, update statuses). Clean separation — no circular imports, worker tasks are self-contained.

### Architecture

```
Request Flow (fast):
  POST /api/renders → create_render() → DB record (PENDING) → COMMIT → enqueue job → return 201

  POST /api/auth/magic-link → create token → enqueue email job → return 200

Worker Flow (background):
  ARQ picks up render job → set RENDERING → download R2 → Gemini API → upload R2 → set COMPLETED/FAILED

  ARQ picks up email job → build URL from token + settings.frontend_url → call Resend API → log result
```

### Critical Ordering: Commit Before Enqueue

Services MUST commit the DB transaction before enqueuing the ARQ job. If the job is enqueued before `session.commit()` completes, the worker may receive a `render_id` for a row that doesn't exist yet. Pattern:

```python
await session.commit()
await session.refresh(render)
pool = await get_arq_pool()
await pool.enqueue_job("render_generate", render.id, _job_id=f"render:{render.id}")
```

If the commit succeeds but enqueue fails (Redis down), the render stays in PENDING state — a retry mechanism or manual re-enqueue can handle this edge case.

### Component Changes

#### 1. ARQ Infrastructure (`backend/app/services/arq.py` — new)

Lazy singleton `ArqRedis` connection pool for enqueuing jobs from services. Uses `asyncio.Lock` to prevent race conditions during concurrent coroutine pool creation (safe within a single-threaded asyncio event loop):

```python
_arq_pool: ArqRedis | None = None
_arq_lock = asyncio.Lock()

async def get_arq_pool() -> ArqRedis:
    """Get or create the ARQ Redis connection pool."""
    global _arq_pool
    if _arq_pool is None:
        async with _arq_lock:
            if _arq_pool is None:
                _arq_pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _arq_pool

async def close_arq_pool() -> None:
    """Close the ARQ pool. Called during FastAPI lifespan shutdown."""
    global _arq_pool
    if _arq_pool is not None:
        await _arq_pool.aclose()
        _arq_pool = None
```

`close_arq_pool()` is called in the FastAPI lifespan `shutdown` phase to prevent Redis connection leaks on restart.

#### 2. Worker Setup (`backend/app/worker.py`)

**Startup:** Create a dedicated async SQLAlchemy engine and session factory (separate from `db.py` since the worker runs in its own process). Use a smaller pool (`pool_size=5, max_overflow=3`) since the worker has lower concurrency than the API. Store session factory in `ctx["session_factory"]`.

**Shutdown:** Dispose the worker's engine.

**Tasks:**

- `render_generate(ctx, render_id: UUID, delete_old: bool = False)` — single task for both create and regenerate. Downloads from R2, calls Gemini, uploads result, updates DB status to COMPLETED or FAILED. When `delete_old=True`, deletes the previous `result_image_key` before uploading. As a first step, checks current status — if already RENDERING (another job running), exits early to prevent double-processing.
- `send_email(ctx, email_type: str, to_email: str, token: str, org_name: str | None)` — builds the full URL from `token` + `settings.frontend_url` (worker must have `FRONTEND_URL` env var). Calls Resend API with appropriate template based on `email_type`.

**Job deduplication:** Use ARQ's `_job_id` parameter when enqueuing to prevent duplicate jobs. For renders: `_job_id=f"render:{render_id}"`. ARQ will reject a job if one with the same ID is already queued or running.

**Retry policies:**
- Render tasks: 1 retry (Gemini failures are usually deterministic)
- Email tasks: 3 retries with exponential backoff (transient network failures). Duplicate emails on retry are acceptable — magic links and invites are idempotent from the user's perspective.

**WorkerSettings update:**
```python
functions = [render_generate, send_email]
```

#### 3. Render Service (`backend/app/services/renders.py`)

**`create_render()`** changes:
- Creates DB record with status `PENDING` (no longer transitions to `RENDERING`)
- Commits the DB transaction first, then enqueues `render_generate` job
- Uses `_job_id=f"render:{render_id}"` for deduplication
- Returns immediately

**`regenerate_render()`** changes:
- Checks current status — rejects if already `RENDERING` (guard against double-click)
- Updates description if provided, sets status `PENDING`
- Commits, then enqueues `render_generate` job with `delete_old=True`
- Returns immediately

**`generate_image()`** stays in this file but is only called by worker tasks (imported into worker.py).

#### 4. Email Service (`backend/app/services/email.py`)

**`send_magic_link_email()`** changes:
- If no API key configured: keep dev-mode console fallback (no enqueue), return `False` (preserves current behavior)
- Otherwise: enqueue `send_email` job with `email_type="magic_link"`, recipient, token. Return `True` (job enqueued, not necessarily delivered — callers treat as fire-and-forget)

**`send_onboarding_invite_email()`** changes:
- Same pattern: dev-mode returns `False`, production enqueues with `email_type="onboarding_invite"` and returns `True`

**URL construction:** The worker task builds the full URL from `token` + `settings.frontend_url`. The service only passes the token. Worker container must have `FRONTEND_URL` env var set (same value as API container).

#### 5. Frontend Polling

Add polling on the **render detail view only** when status is `PENDING` or `RENDERING`:
- Poll `GET /api/renders/{id}` every 3 seconds
- Stop polling when status becomes `COMPLETED` or `FAILED`
- Maximum polling duration: 5 minutes (show timeout message if exceeded)
- Use the frontend's existing data-fetching library refetch interval mechanism
- List view does NOT poll — user refreshes manually or navigates to detail view

### Worker Health & Observability

- Worker tasks log structured output: job name, duration, success/failure, error details
- Failed render jobs write `error_message` to the Render DB record (existing behavior, moves to worker)
- Existing `/health` endpoint pings Redis — if Redis is down, API reports "degraded"
- Railway config already has `restartPolicyType = "on_failure"` with 5 max retries
- No new alerting infrastructure needed at this stage

### Railway Deployment

`backend/railway-worker.toml` already exists and is correctly configured:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile.railway"

[deploy]
startCommand = "uv run arq app.worker.WorkerSettings"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

No deployment changes needed.

## File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/app/services/arq.py` | New | ARQ Redis pool singleton for enqueuing |
| `backend/app/worker.py` | Modify | Add startup/shutdown, render + email tasks, retry configs |
| `backend/app/services/renders.py` | Modify | Enqueue instead of inline generate |
| `backend/app/services/email.py` | Modify | Enqueue instead of inline Resend call |
| Frontend render components | Modify | Add polling for PENDING/RENDERING status |
| `backend/tests/test_worker.py` | New | Tests for worker tasks |
| `backend/tests/` (existing) | Modify | Update render/email service tests for async flow |

## Testing Strategy

- **Worker tasks:** Unit test each task function with mocked external services (Gemini, R2, Resend)
- **Service enqueuing:** Test that services enqueue the correct job with correct args (mock ARQ pool)
- **Integration:** Test full flow — create render → verify PENDING → run worker task → verify COMPLETED
- **Email dev mode:** Verify console fallback still works when no API key is set
- **Error handling:** Test that render failures set status FAILED with error_message
- **Enqueue failure:** Test behavior when Redis is unavailable at enqueue time (should propagate exception, resulting in 500)
- **Deduplication:** Test that re-enqueuing a render with same job_id is rejected by ARQ
- **Regenerate guard:** Test that regenerating a RENDERING render is rejected

## Acceptance Criteria

- [ ] Render generation runs as an ARQ background job (create + regenerate)
- [ ] Email sending runs as an ARQ background job (magic link + onboarding invite)
- [ ] POST `/api/renders` returns immediately with status PENDING
- [ ] Frontend polls for render completion
- [ ] Dev-mode email console fallback preserved
- [ ] Worker failures logged and render errors persisted to DB
- [ ] ARQ pool properly closed on API shutdown
- [ ] Job deduplication prevents double-processing renders
- [ ] Regenerate rejects renders already in RENDERING state
- [ ] Existing tests updated, new worker tests added
