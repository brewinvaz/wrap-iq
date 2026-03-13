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
  POST /api/renders → create_render() → DB record (PENDING) → enqueue job → return 201

  POST /api/auth/magic-link → create token → enqueue email job → return 200

Worker Flow (background):
  ARQ picks up render job → set RENDERING → download R2 → Gemini API → upload R2 → set COMPLETED/FAILED

  ARQ picks up email job → call Resend API → log result
```

### Component Changes

#### 1. ARQ Infrastructure (`backend/app/services/arq.py` — new)

Lazy singleton `ArqRedis` connection pool for enqueuing jobs from services:

```python
_arq_pool: ArqRedis | None = None

async def get_arq_pool() -> ArqRedis:
    """Get or create the ARQ Redis connection pool."""
    global _arq_pool
    if _arq_pool is None:
        _arq_pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _arq_pool
```

#### 2. Worker Setup (`backend/app/worker.py`)

**Startup:** Create async SQLAlchemy session factory, store in `ctx["session_factory"]`.

**Shutdown:** Dispose the engine.

**Tasks:**

- `render_generate(ctx, render_id: UUID)` — downloads from R2, calls Gemini, uploads result, updates DB status to COMPLETED or FAILED
- `render_regenerate(ctx, render_id: UUID)` — same as generate but deletes old result first
- `send_email(ctx, email_type: str, to_email: str, token: str, org_name: str | None)` — calls Resend API with appropriate template based on `email_type`

**Retry policies:**
- Render tasks: 1 retry (Gemini failures are usually deterministic)
- Email tasks: 3 retries with exponential backoff (transient network failures)

**WorkerSettings update:**
```python
functions = [render_generate, render_regenerate, send_email]
```

#### 3. Render Service (`backend/app/services/renders.py`)

**`create_render()`** changes:
- Creates DB record with status `PENDING` (no longer transitions to `RENDERING`)
- Enqueues `render_generate` job with `render_id`
- Returns immediately

**`regenerate_render()`** changes:
- Updates description if provided, sets status `PENDING`
- Enqueues `render_regenerate` job with `render_id`
- Returns immediately

**`generate_image()`** stays in this file but is only called by worker tasks (imported into worker.py).

#### 4. Email Service (`backend/app/services/email.py`)

**`send_magic_link_email()`** changes:
- If no API key configured: keep dev-mode console fallback (no enqueue)
- Otherwise: enqueue `send_email` job with `email_type="magic_link"`, recipient, token
- Returns `True` immediately (fire-and-forget)

**`send_onboarding_invite_email()`** changes:
- Same pattern: enqueue with `email_type="onboarding_invite"`, recipient, token, org_name
- Returns `True` immediately

#### 5. Frontend Polling

Add polling on render detail/list views when status is `PENDING` or `RENDERING`:
- Poll `GET /api/renders/{id}` every 2-3 seconds
- Stop polling when status becomes `COMPLETED` or `FAILED`
- Use existing React Query / SWR refetch interval mechanism

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

## Acceptance Criteria

- [ ] Render generation runs as an ARQ background job (create + regenerate)
- [ ] Email sending runs as an ARQ background job (magic link + onboarding invite)
- [ ] POST `/api/renders` returns immediately with status PENDING
- [ ] Frontend polls for render completion
- [ ] Dev-mode email console fallback preserved
- [ ] Worker failures logged and render errors persisted to DB
- [ ] Existing tests updated, new worker tests added
