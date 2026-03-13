# ARQ Worker Jobs (Renders + Emails) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move render generation and email sending from synchronous HTTP handlers to ARQ background worker tasks.

**Architecture:** Services enqueue jobs to ARQ via a shared Redis pool. Worker tasks execute in a separate process with their own DB engine. Renders return immediately with PENDING status; emails are fire-and-forget. Frontend polls for render completion.

**Tech Stack:** ARQ, Redis, SQLAlchemy async, FastAPI lifespan, Resend, Google Gemini API

**Spec:** `docs/superpowers/specs/2026-03-13-arq-worker-jobs-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/services/arq.py` | Create | ARQ Redis pool singleton (enqueue side) |
| `backend/app/worker.py` | Modify | Worker startup/shutdown, render + email task functions |
| `backend/app/services/renders.py` | Modify | Enqueue render jobs instead of inline generation |
| `backend/app/services/email.py` | Modify | Enqueue email jobs instead of inline Resend calls |
| `backend/app/routers/renders.py` | Modify | Handle 409 for RENDERING state on regenerate |
| `backend/app/main.py` | Modify | Close ARQ pool on shutdown |
| `frontend/src/app/dashboard/3d/page.tsx` | Modify | Poll for render status on create/regenerate |
| `backend/tests/test_services/test_arq.py` | Create | Tests for ARQ pool singleton |
| `backend/tests/test_worker.py` | Create | Tests for worker task functions |
| `backend/tests/test_services/test_email.py` | Modify | Update email tests for enqueue flow |
| `backend/tests/test_renders.py` | Modify | Update render service tests for enqueue flow |

---

## Chunk 1: ARQ Infrastructure + Worker Foundation

### Task 1: ARQ Redis Pool Singleton

**Files:**
- Create: `backend/app/services/arq.py`
- Test: `backend/tests/test_services/test_arq.py`

- [ ] **Step 1: Write tests for ARQ pool**

Create `backend/tests/test_services/test_arq.py`:

```python
import asyncio
from unittest.mock import AsyncMock, patch

from app.services.arq import close_arq_pool, get_arq_pool


class TestGetArqPool:
    async def test_returns_pool(self):
        with patch("app.services.arq.create_pool", new_callable=AsyncMock) as mock_create:
            mock_pool = AsyncMock()
            mock_create.return_value = mock_pool

            # Reset module state
            import app.services.arq as arq_mod
            arq_mod._arq_pool = None

            pool = await get_arq_pool()
            assert pool is mock_pool
            mock_create.assert_called_once()

    async def test_returns_same_pool_on_second_call(self):
        with patch("app.services.arq.create_pool", new_callable=AsyncMock) as mock_create:
            mock_pool = AsyncMock()
            mock_create.return_value = mock_pool

            import app.services.arq as arq_mod
            arq_mod._arq_pool = None

            pool1 = await get_arq_pool()
            pool2 = await get_arq_pool()
            assert pool1 is pool2
            mock_create.assert_called_once()


class TestCloseArqPool:
    async def test_closes_pool(self):
        import app.services.arq as arq_mod
        mock_pool = AsyncMock()
        arq_mod._arq_pool = mock_pool

        await close_arq_pool()
        mock_pool.aclose.assert_called_once()
        assert arq_mod._arq_pool is None

    async def test_noop_when_no_pool(self):
        import app.services.arq as arq_mod
        arq_mod._arq_pool = None

        await close_arq_pool()  # should not raise
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_services/test_arq.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.arq'`

- [ ] **Step 3: Implement ARQ pool singleton**

Create `backend/app/services/arq.py`:

```python
import asyncio
import logging

from arq.connections import ArqRedis, RedisSettings, create_pool

from app.config import settings

logger = logging.getLogger("wrapiq")

_arq_pool: ArqRedis | None = None
_arq_lock = asyncio.Lock()


async def get_arq_pool() -> ArqRedis:
    """Get or create the ARQ Redis connection pool.

    Safe within a single-threaded asyncio event loop.
    """
    global _arq_pool
    if _arq_pool is None:
        async with _arq_lock:
            if _arq_pool is None:
                _arq_pool = await create_pool(
                    RedisSettings.from_dsn(settings.redis_url)
                )
                logger.info("ARQ pool created")
    return _arq_pool


async def close_arq_pool() -> None:
    """Close the ARQ pool. Called during FastAPI lifespan shutdown."""
    global _arq_pool
    if _arq_pool is not None:
        await _arq_pool.aclose()
        _arq_pool = None
        logger.info("ARQ pool closed")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_services/test_arq.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/arq.py backend/tests/test_services/test_arq.py
git commit -m "feat: add ARQ Redis pool singleton for job enqueuing"
```

---

### Task 2: FastAPI Lifespan Shutdown

**Files:**
- Modify: `backend/app/main.py:55-76`

- [ ] **Step 1: Add pool shutdown to lifespan**

In `backend/app/main.py`, update the `lifespan` function. After the `yield` on line 74, add the shutdown call:

```python
# Add import at top of file (with other imports):
from app.services.arq import close_arq_pool

# Update the lifespan function — add after `yield`:
    yield
    # Shutdown
    await close_arq_pool()
```

- [ ] **Step 2: Verify app still starts**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_routers/ -v -x --timeout=30 -k "test_list_requires_auth"`
Expected: PASS (confirms app lifespan works)

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: close ARQ pool on FastAPI shutdown"
```

---

### Task 3: Worker Startup/Shutdown with DB Engine

**Files:**
- Modify: `backend/app/worker.py`
- Test: `backend/tests/test_worker.py`

- [ ] **Step 1: Write tests for worker lifecycle**

Create `backend/tests/test_worker.py`:

```python
from unittest.mock import AsyncMock, MagicMock, patch

from app.worker import shutdown, startup


class TestWorkerLifecycle:
    async def test_startup_creates_session_factory(self):
        ctx = {}
        with patch("app.worker.create_async_engine") as mock_engine, \
             patch("app.worker.async_sessionmaker") as mock_session:
            mock_engine.return_value = MagicMock()
            mock_session.return_value = MagicMock()

            await startup(ctx)

            assert "session_factory" in ctx
            assert "engine" in ctx
            mock_engine.assert_called_once()

    async def test_shutdown_disposes_engine(self):
        mock_engine = AsyncMock()
        ctx = {"engine": mock_engine}

        await shutdown(ctx)

        mock_engine.dispose.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_worker.py::TestWorkerLifecycle -v`
Expected: FAIL — `startup` doesn't populate ctx

- [ ] **Step 3: Implement worker startup/shutdown**

Replace the contents of `backend/app/worker.py`.

**Important:** All imports MUST be at module top level (ruff `E402` enforcement). Do NOT put imports inside function bodies.

```python
import logging
import uuid

import resend
from arq import func
from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.render import Render, RenderStatus
from app.services.r2 import delete_object, generate_object_key, upload_object
from app.services.renders import generate_image

logger = logging.getLogger("wrapiq")


async def startup(ctx: dict) -> None:
    engine = create_async_engine(
        settings.async_database_url,
        echo=settings.debug,
        pool_size=5,
        max_overflow=3,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=30,
    )
    ctx["engine"] = engine
    ctx["session_factory"] = async_sessionmaker(engine, expire_on_commit=False)
    logger.info("Worker started — DB pool ready")


async def shutdown(ctx: dict) -> None:
    engine = ctx.get("engine")
    if engine:
        await engine.dispose()
    logger.info("Worker stopped — DB pool disposed")


class WorkerSettings:
    functions: list = []  # populated in later tasks
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
```

Note: `functions` list is empty at this step and will be populated as tasks are added. The `from arq import cron` import is included for future use but can be removed by the linter step if unused.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_worker.py::TestWorkerLifecycle -v`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/worker.py backend/tests/test_worker.py
git commit -m "feat: add worker startup/shutdown with dedicated DB engine"
```

---

## Chunk 2: Render Generation Background Job

### Task 4: Worker Render Task

**Files:**
- Modify: `backend/app/worker.py`
- Modify: `backend/tests/test_worker.py`

**Prerequisite:** First, add a shared `seed_org_and_user` fixture to `backend/tests/conftest.py` (used by both test_worker.py and test_renders.py):

```python
# Add imports at top of conftest.py:
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import User

# Add fixture after db_session fixture:
@pytest.fixture
async def seed_org_and_user(db_session) -> tuple:
    """Create a plan, org, and user for testing."""
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Test Org", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email="worker@test.com",
        hashed_password="hashed",
        organization_id=org.id,
        role="admin",
    )
    db_session.add(user)
    await db_session.flush()
    return org, user
```

Also add `import uuid` to conftest.py imports if not already present.

- [ ] **Step 1: Write tests for render_generate worker task**

Add to `backend/tests/test_worker.py`:

```python
from app.models.render import Render, RenderStatus
from app.worker import render_generate


class TestRenderGenerateTask:
    async def test_successful_render(self, setup_db, db_session, seed_org_and_user):
        """render_generate should set status COMPLETED and store result key."""
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            created_by=user.id,
            status=RenderStatus.PENDING,
        )
        db_session.add(render)
        await db_session.commit()
        render_id = render.id

        # Build worker context using the test engine from setup_db fixture
        from sqlalchemy.ext.asyncio import async_sessionmaker
        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen, \
             patch("app.worker.upload_object") as mock_upload, \
             patch("app.worker.generate_object_key") as mock_key:
            mock_gen.return_value = b"result-image"
            mock_key.return_value = f"{org.id}/renders/result.jpg"

            await render_generate(ctx, str(render_id))

        await db_session.refresh(render)
        assert render.status == RenderStatus.COMPLETED
        assert render.result_image_key is not None

    async def test_failed_render(self, setup_db, db_session, seed_org_and_user):
        """render_generate should set status FAILED on error."""
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            created_by=user.id,
            status=RenderStatus.PENDING,
        )
        db_session.add(render)
        await db_session.commit()
        render_id = render.id

        from sqlalchemy.ext.asyncio import async_sessionmaker
        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = RuntimeError("Gemini API error")

            await render_generate(ctx, str(render_id))

        await db_session.refresh(render)
        assert render.status == RenderStatus.FAILED
        assert "Gemini API error" in render.error_message

    async def test_skips_if_already_rendering(self, setup_db, db_session, seed_org_and_user):
        """render_generate should exit early if render is already RENDERING."""
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            created_by=user.id,
            status=RenderStatus.RENDERING,
        )
        db_session.add(render)
        await db_session.commit()
        render_id = render.id

        from sqlalchemy.ext.asyncio import async_sessionmaker
        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen:
            await render_generate(ctx, str(render_id))
            mock_gen.assert_not_called()

    async def test_delete_old_on_regenerate(self, setup_db, db_session, seed_org_and_user):
        """render_generate with delete_old=True should delete old result."""
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            result_image_key=f"{org.id}/renders/old_result.jpg",
            created_by=user.id,
            status=RenderStatus.PENDING,
        )
        db_session.add(render)
        await db_session.commit()
        render_id = render.id

        from sqlalchemy.ext.asyncio import async_sessionmaker
        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen, \
             patch("app.worker.upload_object") as mock_upload, \
             patch("app.worker.generate_object_key") as mock_key, \
             patch("app.worker.delete_object") as mock_delete:
            mock_gen.return_value = b"new-result"
            mock_key.return_value = f"{org.id}/renders/new_result.jpg"

            await render_generate(ctx, str(render_id), delete_old=True)

        mock_delete.assert_called_once_with(f"{org.id}/renders/old_result.jpg")
```

Note: The `setup_db` fixture yields the test engine directly, so we pass it to `async_sessionmaker` instead of `db_session.bind` (which doesn't exist in SQLAlchemy 2.x).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_worker.py::TestRenderGenerateTask -v`
Expected: FAIL — `render_generate` not defined

- [ ] **Step 3: Implement render_generate worker task**

Add to `backend/app/worker.py` (after the `shutdown` function). All imports are already at module top level from Task 3:

```python
async def render_generate(
    ctx: dict,
    render_id: str,
    delete_old: bool = False,
) -> None:
    """Background task: generate a render image via Gemini API."""
    session_factory = ctx["session_factory"]
    rid = uuid.UUID(render_id)

    async with session_factory() as session:
        result = await session.execute(
            select(Render).where(Render.id == rid)
        )
        render = result.scalar_one_or_none()
        if not render:
            logger.error("Render %s not found", render_id)
            return

        if render.status == RenderStatus.RENDERING:
            logger.warning("Render %s already rendering, skipping", render_id)
            return

        render.status = RenderStatus.RENDERING
        render.error_message = None
        await session.commit()

        try:
            result_bytes = await generate_image(
                render.vehicle_photo_key,
                render.wrap_design_key,
                render.description,
            )

            if delete_old and render.result_image_key:
                try:
                    delete_object(render.result_image_key)
                except Exception:
                    logger.warning("Failed to delete old result: %s", render.result_image_key)

            result_key = generate_object_key(
                render.organization_id, "result.jpg", prefix="renders"
            )
            upload_object(result_key, result_bytes, "image/jpeg")

            render.result_image_key = result_key
            render.status = RenderStatus.COMPLETED
            logger.info("Render %s completed", render_id)
        except Exception as exc:
            logger.exception("Render %s failed", render_id)
            render.status = RenderStatus.FAILED
            render.error_message = str(exc)[:500]

        await session.commit()
```

Update `WorkerSettings.functions` to include `render_generate` with retry policy:

```python
class WorkerSettings:
    functions = [func(render_generate, max_tries=2)]  # 1 retry
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
```

`max_tries=2` means 1 original attempt + 1 retry (Gemini failures are usually deterministic per spec). `from arq import func` is already in the module imports from Task 3.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_worker.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/worker.py backend/tests/test_worker.py
git commit -m "feat: add render_generate ARQ worker task"
```

---

### Task 5: Render Service — Enqueue Instead of Inline Generate

**Files:**
- Modify: `backend/app/services/renders.py`
- Modify: `backend/tests/test_renders.py`

- [ ] **Step 1: Write tests for async create_render**

Add to `backend/tests/test_renders.py`:

```python
class TestCreateRenderEnqueue:
    @patch("app.services.renders.get_arq_pool", new_callable=AsyncMock)
    async def test_create_render_enqueues_job(self, mock_get_pool, db_session, seed_org_and_user):
        """create_render should create record as PENDING and enqueue job."""
        mock_pool = AsyncMock()
        mock_get_pool.return_value = mock_pool

        org, user = seed_org_and_user

        render = await render_service.create_render(
            session=db_session,
            user=user,
            design_name="Async Test",
            description=None,
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            work_order_id=None,
            client_id=None,
            vehicle_id=None,
        )

        assert render.status == RenderStatus.PENDING
        mock_pool.enqueue_job.assert_called_once()
        call_args = mock_pool.enqueue_job.call_args
        assert call_args.args[0] == "render_generate"
        assert call_args.args[1] == str(render.id)

    @patch("app.services.renders.get_arq_pool", new_callable=AsyncMock)
    async def test_regenerate_enqueues_job(self, mock_get_pool, db_session, seed_org_and_user):
        """regenerate_render should set PENDING and enqueue job."""
        mock_pool = AsyncMock()
        mock_get_pool.return_value = mock_pool

        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            created_by=user.id,
            status=RenderStatus.COMPLETED,
        )
        db_session.add(render)
        await db_session.commit()

        result = await render_service.regenerate_render(db_session, render, "New desc")
        assert result.status == RenderStatus.PENDING
        assert result.description == "New desc"
        mock_pool.enqueue_job.assert_called_once()

    async def test_regenerate_rejects_rendering_state(self, db_session, seed_org_and_user):
        """regenerate_render should raise ValueError if render is RENDERING."""
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            created_by=user.id,
            status=RenderStatus.RENDERING,
        )
        db_session.add(render)
        await db_session.commit()

        with pytest.raises(ValueError, match="already rendering"):
            await render_service.regenerate_render(db_session, render)
```

Note: The `seed_org_and_user` fixture is defined in `conftest.py` (added in Task 4). No additional imports needed in test_renders.py — pytest auto-discovers fixtures from conftest.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_renders.py::TestCreateRenderEnqueue -v`
Expected: FAIL — `create_render` still calls `generate_image` inline

- [ ] **Step 3: Update create_render and regenerate_render in renders.py**

In `backend/app/services/renders.py`:

Add import at top:
```python
from app.services.arq import get_arq_pool
```

Replace `create_render` function (lines 158-214):

```python
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

    await validate_ownership(
        session, user.organization_id, work_order_id, client_id, vehicle_id
    )

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
    await session.commit()
    await session.refresh(render)

    pool = await get_arq_pool()
    await pool.enqueue_job(
        "render_generate",
        str(render.id),
        _job_id=f"render:{render.id}",
    )

    return render
```

Replace `regenerate_render` function (lines 283-320):

```python
async def regenerate_render(
    session: AsyncSession,
    render: Render,
    description: str | None = None,
) -> Render:
    if render.status == RenderStatus.RENDERING:
        raise ValueError("Render is already rendering")

    if description is not None:
        render.description = description

    render.status = RenderStatus.PENDING
    render.error_message = None
    await session.commit()
    await session.refresh(render)

    pool = await get_arq_pool()
    await pool.enqueue_job(
        "render_generate",
        str(render.id),
        delete_old=True,
        _job_id=f"render:{render.id}",
    )

    return render
```

- [ ] **Step 4: Update the regenerate router to handle ValueError**

In `backend/app/routers/renders.py`, update the `regenerate_render` endpoint (line 165). Add `ValueError` to the exception handling:

```python
    try:
        render = await render_service.regenerate_render(
            session, render, description=body.description if body else None
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_renders.py -v`
Expected: All tests PASS (existing + new)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/renders.py backend/app/routers/renders.py backend/tests/test_renders.py
git commit -m "feat: render create/regenerate enqueue ARQ jobs instead of inline generation"
```

---

## Chunk 3: Email Background Job

### Task 6: Worker Email Task

**Files:**
- Modify: `backend/app/worker.py`
- Modify: `backend/tests/test_worker.py`

- [ ] **Step 1: Write tests for send_email worker task**

Add to `backend/tests/test_worker.py`:

```python
from app.worker import send_email


class TestSendEmailTask:
    @patch("app.worker.resend")
    @patch("app.worker.settings")
    async def test_sends_magic_link(self, mock_settings, mock_resend):
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.frontend_url = "https://app.example.com"
        mock_settings.email_from = "noreply@example.com"

        ctx = {}
        await send_email(
            ctx,
            email_type="magic_link",
            to_email="user@test.com",
            token="abc123",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == ["user@test.com"]
        assert "abc123" in call_args["html"]
        assert "https://app.example.com/auth/magic-link" in call_args["html"]

    @patch("app.worker.resend")
    @patch("app.worker.settings")
    async def test_sends_onboarding_invite(self, mock_settings, mock_resend):
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.frontend_url = "https://app.example.com"
        mock_settings.email_from = "noreply@example.com"

        ctx = {}
        await send_email(
            ctx,
            email_type="onboarding_invite",
            to_email="client@test.com",
            token="def456",
            org_name="Test Wraps Co",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == ["client@test.com"]
        assert "Test Wraps Co" in call_args["html"]
        assert "https://app.example.com/onboard" in call_args["html"]

    @patch("app.worker.resend")
    @patch("app.worker.settings")
    async def test_unknown_email_type_raises(self, mock_settings, mock_resend):
        mock_settings.resend_api_key = "re_test_key"
        ctx = {}
        with pytest.raises(ValueError, match="Unknown email type"):
            await send_email(ctx, email_type="unknown", to_email="a@b.com", token="x")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_worker.py::TestSendEmailTask -v`
Expected: FAIL — `send_email` not defined

- [ ] **Step 3: Implement send_email worker task**

Add to `backend/app/worker.py` (after `render_generate`). The `resend` import is already at module top level from Task 3:

```python
async def send_email(
    ctx: dict,
    email_type: str,
    to_email: str,
    token: str,
    org_name: str | None = None,
) -> None:
    """Background task: send an email via Resend API."""
    resend.api_key = settings.resend_api_key

    if email_type == "magic_link":
        magic_url = f"{settings.frontend_url}/auth/magic-link?token={token}"
        resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to_email],
                "subject": "Your WrapFlow login link",
                "html": (
                    f"<p>Click the link below to log in:</p>"
                    f'<p><a href="{magic_url}">Log in to WrapFlow</a></p>'
                    f"<p>This link expires in 15 minutes.</p>"
                ),
            }
        )
        logger.info("Magic link email sent to %s", to_email)

    elif email_type == "onboarding_invite":
        onboarding_url = f"{settings.frontend_url}/onboard?token={token}"
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
        logger.info("Onboarding invite sent to %s", to_email)

    else:
        raise ValueError(f"Unknown email type: {email_type}")
```

Update `WorkerSettings.functions` with retry policies per spec:
```python
class WorkerSettings:
    functions = [
        func(render_generate, max_tries=2),       # 1 retry (Gemini failures usually deterministic)
        func(send_email, max_tries=4),             # 3 retries with backoff (transient network)
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_worker.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/worker.py backend/tests/test_worker.py
git commit -m "feat: add send_email ARQ worker task"
```

---

### Task 7: Email Service — Enqueue Instead of Inline Send

**Files:**
- Modify: `backend/app/services/email.py`
- Modify: `backend/tests/test_services/test_email.py`

- [ ] **Step 1: Write tests for email enqueuing**

Replace `backend/tests/test_services/test_email.py`:

```python
import logging
from unittest.mock import AsyncMock, patch

import pytest

from app.services.email import send_magic_link_email, send_onboarding_invite_email


@pytest.mark.asyncio
async def test_send_magic_link_dev_mode(caplog):
    """Dev mode (no API key) should log to console and return False."""
    with patch("app.services.email.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        mock_settings.frontend_url = "http://localhost:3000"

        with caplog.at_level(logging.INFO, logger="wrapiq"):
            result = await send_magic_link_email("user@test.com", "token123")

        assert result is False
        assert "token123" in caplog.text


@pytest.mark.asyncio
async def test_send_magic_link_enqueues_job():
    """Production mode should enqueue ARQ job and return True."""
    with patch("app.services.email.settings") as mock_settings, \
         patch("app.services.email.get_arq_pool", new_callable=AsyncMock) as mock_get_pool:
        mock_settings.resend_api_key = "re_test_key"
        mock_pool = AsyncMock()
        mock_get_pool.return_value = mock_pool

        result = await send_magic_link_email("user@test.com", "token123")

        assert result is True
        mock_pool.enqueue_job.assert_called_once_with(
            "send_email",
            email_type="magic_link",
            to_email="user@test.com",
            token="token123",
            org_name=None,
        )


@pytest.mark.asyncio
async def test_send_onboarding_invite_enqueues_job():
    """Production mode should enqueue onboarding invite job."""
    with patch("app.services.email.settings") as mock_settings, \
         patch("app.services.email.get_arq_pool", new_callable=AsyncMock) as mock_get_pool:
        mock_settings.resend_api_key = "re_test_key"
        mock_pool = AsyncMock()
        mock_get_pool.return_value = mock_pool

        result = await send_onboarding_invite_email(
            "client@test.com", "token456", "Test Wraps Co"
        )

        assert result is True
        mock_pool.enqueue_job.assert_called_once_with(
            "send_email",
            email_type="onboarding_invite",
            to_email="client@test.com",
            token="token456",
            org_name="Test Wraps Co",
        )


@pytest.mark.asyncio
async def test_send_onboarding_invite_dev_mode(caplog):
    """Dev mode should log to console and return False."""
    with patch("app.services.email.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        mock_settings.frontend_url = "http://localhost:3000"

        with caplog.at_level(logging.INFO, logger="wrapiq"):
            result = await send_onboarding_invite_email(
                "client@test.com", "token456", "Test Wraps Co"
            )

        assert result is False
        assert "token456" in caplog.text
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_services/test_email.py -v`
Expected: FAIL — email service still calls Resend directly

- [ ] **Step 3: Update email service to enqueue jobs**

Replace `backend/app/services/email.py`:

```python
import logging

from app.config import settings
from app.services.arq import get_arq_pool

logger = logging.getLogger("wrapiq")


async def send_magic_link_email(to_email: str, token: str) -> bool:
    """Send a magic-link email. Returns True if enqueued, False in dev mode."""
    if not settings.resend_api_key:
        magic_url = f"{settings.frontend_url}/auth/magic-link?token={token}"
        logger.warning("Resend not configured — magic link email will not be sent")
        logger.info("[DEV] Magic link for %s: %s", to_email, magic_url)
        return False

    pool = await get_arq_pool()
    await pool.enqueue_job(
        "send_email",
        email_type="magic_link",
        to_email=to_email,
        token=token,
        org_name=None,
    )
    return True


async def send_onboarding_invite_email(
    to_email: str, token: str, org_name: str
) -> bool:
    """Send an onboarding invite email. Returns True if enqueued, False in dev mode."""
    if not settings.resend_api_key:
        onboarding_url = f"{settings.frontend_url}/onboard?token={token}"
        logger.warning("Resend not configured — onboarding invite will not be sent")
        logger.info("[DEV] Onboarding invite for %s: %s", to_email, onboarding_url)
        return False

    pool = await get_arq_pool()
    await pool.enqueue_job(
        "send_email",
        email_type="onboarding_invite",
        to_email=to_email,
        token=token,
        org_name=org_name,
    )
    return True
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_services/test_email.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/email.py backend/tests/test_services/test_email.py
git commit -m "feat: email sending enqueues ARQ jobs instead of inline Resend calls"
```

---

## Chunk 4: Frontend Polling

### Task 8: Poll for Render Completion

**Files:**
- Modify: `frontend/src/app/dashboard/3d/page.tsx`

- [ ] **Step 1: Add polling effect to the 3D page**

Note: The spec says "poll detail view only," but the app has no separate render detail page — the 3D page (`page.tsx`) IS the only render view. We poll individual in-progress renders via `GET /api/renders/{id}` and merge results into state, avoiding a full list refetch.

In `frontend/src/app/dashboard/3d/page.tsx`, add a `useEffect` inside the `ThreeDPage` component (after the existing `useEffect` that calls `fetchRenders()`, around line 254):

```typescript
  // Poll individual in-progress renders via detail endpoint
  useEffect(() => {
    const inProgress = renders.filter(
      (r) => r.status === 'pending' || r.status === 'rendering'
    );
    if (inProgress.length === 0) return;

    const startTime = Date.now();
    const MAX_POLL_DURATION = 5 * 60 * 1000; // 5 minutes

    const interval = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_DURATION) {
        clearInterval(interval);
        return;
      }
      try {
        const updates = await Promise.all(
          inProgress.map((r) => api.get<RenderResponse>(`/api/renders/${r.id}`))
        );
        setRenders((prev) =>
          prev.map((r) => {
            const updated = updates.find((u) => u.id === r.id);
            return updated ?? r;
          })
        );
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [renders]);
```

This polls `GET /api/renders/{id}` for each in-progress render (typically 1) every 3 seconds, and stops when all renders reach COMPLETED/FAILED or after 5 minutes.

- [ ] **Step 2: Update the onCreate callback to not show "created successfully" toast**

The render is now created in PENDING state, not completed. Update the `onCreate` callback (around line 589) to reflect this:

```typescript
onCreate={() => { fetchRenders(); setToast('Render queued — processing will begin shortly'); }}
```

- [ ] **Step 3: Verify the frontend builds**

Run: `cd /Users/brewinvaz/repos/wrap-iq/frontend && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/3d/page.tsx
git commit -m "feat: add polling for in-progress renders on 3D page"
```

---

## Chunk 5: Integration Tests

### Task 9: Lifespan Shutdown Test

**Files:**
- Test: `backend/tests/test_main_lifespan.py`

- [ ] **Step 1: Write test for lifespan shutdown**

Create `backend/tests/test_main_lifespan.py`:

```python
from unittest.mock import AsyncMock, patch

from app.main import app, lifespan


class TestLifespan:
    async def test_lifespan_closes_arq_pool_on_shutdown(self):
        """Lifespan should call close_arq_pool during shutdown."""
        with patch("app.main.close_arq_pool", new_callable=AsyncMock) as mock_close:
            async with lifespan(app):
                pass
            mock_close.assert_called_once()
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_main_lifespan.py -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_main_lifespan.py
git commit -m "test: add lifespan shutdown test for ARQ pool cleanup"
```

---

### Task 10: Render Integration Test (Create → Worker → Completed)

**Files:**
- Test: `backend/tests/test_integration_renders.py`

- [ ] **Step 1: Write integration test**

Create `backend/tests/test_integration_renders.py`:

```python
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.render import RenderStatus
from app.services import renders as render_service
from app.worker import render_generate


class TestRenderIntegration:
    async def test_create_then_worker_completes_render(
        self, setup_db, db_session, seed_org_and_user
    ):
        """Full flow: create_render enqueues → render_generate completes."""
        org, user = seed_org_and_user

        # Step 1: create_render (with mocked ARQ pool to capture args)
        mock_pool = AsyncMock()
        with patch("app.services.renders.get_arq_pool", new_callable=AsyncMock) as mock_get_pool:
            mock_get_pool.return_value = mock_pool

            render = await render_service.create_render(
                session=db_session,
                user=user,
                design_name="Integration Test",
                description="Full wrap",
                vehicle_photo_key=f"{org.id}/renders/photo.jpg",
                wrap_design_key=f"{org.id}/renders/design.png",
                work_order_id=None,
                client_id=None,
                vehicle_id=None,
            )

        # Verify PENDING and job was enqueued
        assert render.status == RenderStatus.PENDING
        mock_pool.enqueue_job.assert_called_once()
        enqueued_render_id = mock_pool.enqueue_job.call_args.args[1]

        # Step 2: simulate worker picking up the job
        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen, \
             patch("app.worker.upload_object") as mock_upload, \
             patch("app.worker.generate_object_key") as mock_key:
            mock_gen.return_value = b"result-image-bytes"
            mock_key.return_value = f"{org.id}/renders/result.jpg"

            await render_generate(ctx, enqueued_render_id)

        # Step 3: verify final state
        await db_session.refresh(render)
        assert render.status == RenderStatus.COMPLETED
        assert render.result_image_key == f"{org.id}/renders/result.jpg"
        assert render.error_message is None
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test -- tests/test_integration_renders.py -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_integration_renders.py
git commit -m "test: add render create-to-worker integration test"
```

---

## Chunk 6: Linting + Final Verification

### Task 11: Lint and Final Test Run

- [ ] **Step 1: Run backend linter**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make lint`
Expected: No errors. If there are, fix with `make lint-fix`.

- [ ] **Step 2: Run full backend test suite**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test`
Expected: All tests PASS

- [ ] **Step 3: Run frontend build**

Run: `cd /Users/brewinvaz/repos/wrap-iq/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Fix any issues and commit**

If any fixes were needed:
```bash
git add -A
git commit -m "fix: lint and test fixes for ARQ worker migration"
```
