# Estimated Hours Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three backend gaps in estimated hours (vehicle_type not passed, no PATCH re-matching, no manual override) and display estimated hours in the work order detail and list pages.

**Architecture:** Backend-first approach. Add `extract_vehicle_type` helper, fix creation auto-fill, add PATCH re-matching with manual override support, add missing schema fields. Then wire up frontend display in detail and list pages.

**Tech Stack:** Python/FastAPI/Pydantic (backend), React/Next.js/TypeScript/Tailwind (frontend), pytest (tests)

**Spec:** `docs/superpowers/specs/2026-03-13-estimated-hours-fixes-design.md`

---

## Chunk 1: Backend — vehicle_type helper + schema fixes

### Task 1: Add `extract_vehicle_type` helper to estimate_matching.py

**Files:**
- Modify: `backend/app/services/estimate_matching.py`
- Test: `backend/tests/test_services/test_estimate_matching.py`

- [ ] **Step 1: Write tests for extract_vehicle_type**

Add these tests to `backend/tests/test_services/test_estimate_matching.py`:

```python
from app.services.estimate_matching import extract_vehicle_type


class FakeVehicle:
    def __init__(self, vehicle_type):
        self.vehicle_type = vehicle_type


class FakeWOV:
    def __init__(self, vehicle_type):
        self.vehicle = FakeVehicle(vehicle_type)


def test_extract_vehicle_type_empty():
    assert extract_vehicle_type([]) is None


def test_extract_vehicle_type_single():
    assert extract_vehicle_type([FakeWOV("van")]) == "van"


def test_extract_vehicle_type_all_same():
    wovs = [FakeWOV("suv"), FakeWOV("suv"), FakeWOV("suv")]
    assert extract_vehicle_type(wovs) == "suv"


def test_extract_vehicle_type_mixed():
    wovs = [FakeWOV("van"), FakeWOV("suv")]
    assert extract_vehicle_type(wovs) is None


def test_extract_vehicle_type_with_enum():
    """StrEnum values should be extracted via .value."""
    from app.models.vehicle import VehicleType
    wovs = [FakeWOV(VehicleType.van), FakeWOV(VehicleType.van)]
    assert extract_vehicle_type(wovs) == "van"


def test_extract_vehicle_type_mixed_enum():
    from app.models.vehicle import VehicleType
    wovs = [FakeWOV(VehicleType.van), FakeWOV(VehicleType.suv)]
    assert extract_vehicle_type(wovs) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test ARGS="-k 'test_extract_vehicle_type' -v" 2>&1 | tail -20`
Expected: FAIL — `ImportError: cannot import name 'extract_vehicle_type'`

- [ ] **Step 3: Implement extract_vehicle_type**

Add to `backend/app/services/estimate_matching.py` before the `find_matching_estimates` function:

```python
def extract_vehicle_type(work_order_vehicles) -> str | None:
    """Return the shared vehicle_type string if all vehicles have the same type, else None."""
    if not work_order_vehicles:
        return None
    types = set()
    for wov in work_order_vehicles:
        vt = wov.vehicle.vehicle_type
        types.add(vt.value if hasattr(vt, "value") else vt)
    return types.pop() if len(types) == 1 else None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test ARGS="-k 'test_extract_vehicle_type' -v" 2>&1 | tail -20`
Expected: All 6 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/estimate_matching.py backend/tests/test_services/test_estimate_matching.py
git commit -m "feat: add extract_vehicle_type helper for estimate matching"
```

---

### Task 2: Add estimated_hours to ProductionDetailsResponse and InstallDetailsResponse

**Files:**
- Modify: `backend/app/schemas/production_details.py`
- Modify: `backend/app/schemas/install_details.py`

- [ ] **Step 1: Add estimated_hours to ProductionDetailsResponse**

In `backend/app/schemas/production_details.py`, add to `ProductionDetailsResponse` class after `window_perf_details`:

```python
    estimated_hours: Decimal | None = None
```

Also add the import at top of file:

```python
from decimal import Decimal
```

- [ ] **Step 2: Add estimated_hours to InstallDetailsResponse**

In `backend/app/schemas/install_details.py`, `InstallDetailsResponse` extends `InstallDetailsCreate` so it inherits all fields. Add a new `InstallDetailsResponse` that doesn't extend `InstallDetailsCreate` — or just add the field. Since it extends `InstallDetailsCreate`, add the field directly:

```python
class InstallDetailsResponse(InstallDetailsCreate):
    estimated_hours: Decimal | None = None

    model_config = {"from_attributes": True}
```

Also add the import at top of file:

```python
from decimal import Decimal
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test ARGS="-k 'test_work_order' -v" 2>&1 | tail -30`
Expected: All existing work order tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/production_details.py backend/app/schemas/install_details.py
git commit -m "feat: expose estimated_hours in production and install detail response schemas"
```

---

### Task 3: Add estimated_hours to WorkOrderUpdate and vehicle_type to VehicleInWorkOrder

**Files:**
- Modify: `backend/app/schemas/work_orders.py`

- [ ] **Step 1: Add estimated_hours to WorkOrderUpdate**

In `backend/app/schemas/work_orders.py`, add to the `WorkOrderUpdate` class after `client_id`:

```python
    estimated_hours: Decimal | None = None
```

- [ ] **Step 2: Add vehicle_type to VehicleInWorkOrder**

In `backend/app/schemas/work_orders.py`, add to the `VehicleInWorkOrder` class after `vin`:

```python
    vehicle_type: str | None = None
```

- [ ] **Step 3: Run existing tests**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test ARGS="-k 'test_work_order' -v" 2>&1 | tail -30`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/work_orders.py
git commit -m "feat: add estimated_hours to WorkOrderUpdate, vehicle_type to VehicleInWorkOrder"
```

---

## Chunk 2: Backend — Fix creation auto-fill and PATCH re-matching

### Task 4: Fix creation auto-fill to pass vehicle_type

**Files:**
- Modify: `backend/app/routers/work_orders.py`

- [ ] **Step 1: Update import**

In `backend/app/routers/work_orders.py`, update the import from estimate_matching:

```python
from app.services.estimate_matching import extract_vehicle_type, find_matching_estimates
```

- [ ] **Step 2: Update _to_response to include vehicle_type**

In `backend/app/routers/work_orders.py`, update the vehicles list comprehension in `_to_response` (line 120-128):

Replace:
```python
    vehicles = [
        {
            "id": wov.vehicle.id,
            "make": wov.vehicle.make,
            "model": wov.vehicle.model,
            "year": wov.vehicle.year,
            "vin": wov.vehicle.vin,
        }
        for wov in (wo.work_order_vehicles or [])
    ]
```

With:
```python
    vehicles = [
        {
            "id": wov.vehicle.id,
            "make": wov.vehicle.make,
            "model": wov.vehicle.model,
            "year": wov.vehicle.year,
            "vin": wov.vehicle.vin,
            "vehicle_type": (
                wov.vehicle.vehicle_type.value
                if hasattr(wov.vehicle.vehicle_type, "value")
                else wov.vehicle.vehicle_type
            ),
        }
        for wov in (wo.work_order_vehicles or [])
    ]
```

- [ ] **Step 3: Fix creation auto-fill to pass vehicle_type**

In `backend/app/routers/work_orders.py`, in the `create` handler, replace the existing auto-fill block (lines 218-245):

Replace:
```python
    # Auto-fill estimated hours from estimate defaults
    wrap_coverage = None
    if data.wrap_details and data.wrap_details.wrap_coverage:
        wrap_coverage = data.wrap_details.wrap_coverage.value
    vehicle_count = len(data.vehicle_ids)
    match = await find_matching_estimates(
        session,
        user.organization_id,
        job_type=data.job_type.value,
        vehicle_count=vehicle_count,
        wrap_coverage=wrap_coverage,
    )
```

With:
```python
    # Auto-fill estimated hours from estimate defaults
    wrap_coverage = None
    if data.wrap_details and data.wrap_details.wrap_coverage:
        wrap_coverage = data.wrap_details.wrap_coverage.value
    vehicle_count = len(data.vehicle_ids)
    vehicle_type = extract_vehicle_type(wo.work_order_vehicles or [])
    match = await find_matching_estimates(
        session,
        user.organization_id,
        job_type=data.job_type.value,
        vehicle_count=vehicle_count,
        wrap_coverage=wrap_coverage,
        vehicle_type=vehicle_type,
    )
```

- [ ] **Step 4: Run existing tests**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test ARGS="-k 'test_work_order' -v" 2>&1 | tail -30`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/work_orders.py
git commit -m "fix: pass vehicle_type to estimate matcher during work order creation"
```

---

### Task 5: Add PATCH re-matching logic

**Files:**
- Modify: `backend/app/routers/work_orders.py`
- Test: `backend/tests/test_routers/test_work_orders.py`

- [ ] **Step 1: Write tests for PATCH re-matching**

Add a new test file `backend/tests/test_services/test_estimate_rematching.py`:

```python
"""Tests for estimate re-matching on work order PATCH."""
import uuid
from decimal import Decimal

from app.models.estimate_defaults import EstimateDefaults
from app.models.kanban_stage import KanbanStage
from app.models.organization import Organization
from app.models.plan import Plan


async def _seed_org_with_stage(db_session):
    """Create plan, org, and kanban stage. Return (org_id, stage_id)."""
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Test Shop", slug="test-shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="New",
        color="#000",
        position=0,
        is_active=True,
    )
    db_session.add(stage)
    await db_session.flush()
    return org.id, stage.id


async def _seed_estimate_rules(db_session, org_id):
    """Create two estimate rules: one for commercial, one for personal."""
    commercial = EstimateDefaults(
        organization_id=org_id,
        job_type="commercial",
        design_hours=Decimal("5"),
        production_hours=Decimal("10"),
        install_hours=Decimal("8"),
        priority=1,
        is_active=True,
    )
    personal = EstimateDefaults(
        organization_id=org_id,
        job_type="personal",
        design_hours=Decimal("2"),
        production_hours=Decimal("4"),
        install_hours=Decimal("3"),
        priority=1,
        is_active=True,
    )
    db_session.add_all([commercial, personal])
    await db_session.flush()
    return commercial, personal


async def test_apply_estimates_on_patch_job_type_change(
    auth_client, db_session, seed_user
):
    """Changing job_type on PATCH should re-run estimate matching."""
    org_id = seed_user.organization_id
    await _seed_estimate_rules(db_session, org_id)

    # Create a personal work order
    create_resp = await auth_client.post(
        "/api/work-orders",
        json={
            "job_type": "personal",
            "date_in": "2026-01-15T09:00:00",
        },
    )
    assert create_resp.status_code == 201
    wo_id = create_resp.json()["id"]
    # personal rule: 2 + 4 + 3 = 9
    assert Decimal(str(create_resp.json()["estimated_hours"])) == Decimal("9")

    # PATCH to commercial
    patch_resp = await auth_client.patch(
        f"/api/work-orders/{wo_id}",
        json={"job_type": "commercial"},
    )
    assert patch_resp.status_code == 200
    # commercial rule: 5 + 10 + 8 = 23
    assert Decimal(str(patch_resp.json()["estimated_hours"])) == Decimal("23")


async def test_manual_override_on_patch(auth_client, db_session, seed_user):
    """Explicitly setting estimated_hours on PATCH should override auto-matching."""
    org_id = seed_user.organization_id
    await _seed_estimate_rules(db_session, org_id)

    create_resp = await auth_client.post(
        "/api/work-orders",
        json={
            "job_type": "personal",
            "date_in": "2026-01-15T09:00:00",
        },
    )
    assert create_resp.status_code == 201
    wo_id = create_resp.json()["id"]

    # Manual override
    patch_resp = await auth_client.patch(
        f"/api/work-orders/{wo_id}",
        json={"estimated_hours": "42.5"},
    )
    assert patch_resp.status_code == 200
    assert Decimal(str(patch_resp.json()["estimated_hours"])) == Decimal("42.5")


async def test_no_rematching_on_irrelevant_patch(auth_client, db_session, seed_user):
    """Patching non-estimate fields should not change estimated_hours."""
    org_id = seed_user.organization_id
    await _seed_estimate_rules(db_session, org_id)

    create_resp = await auth_client.post(
        "/api/work-orders",
        json={
            "job_type": "personal",
            "date_in": "2026-01-15T09:00:00",
        },
    )
    assert create_resp.status_code == 201
    wo_id = create_resp.json()["id"]
    original_hours = create_resp.json()["estimated_hours"]

    # PATCH an irrelevant field
    patch_resp = await auth_client.patch(
        f"/api/work-orders/{wo_id}",
        json={"internal_notes": "test note"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["estimated_hours"] == original_hours
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test ARGS="-k 'test_estimate_rematching' -v" 2>&1 | tail -20`
Expected: FAIL — `test_apply_estimates_on_patch_job_type_change` fails because PATCH doesn't re-run matching

- [ ] **Step 3: Implement PATCH re-matching**

In `backend/app/routers/work_orders.py`, replace the PATCH handler (lines 290-306):

```python
@router.patch("/{work_order_id}", response_model=WorkOrderResponse)
async def update(
    work_order_id: uuid.UUID,
    data: WorkOrderUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    wo = await get_work_order(session, work_order_id, user.organization_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    # Validate tenant ownership of client if being updated
    if data.client_id is not None:
        await _validate_client_ownership(session, data.client_id, user.organization_id)

    payload = data.model_dump(exclude_unset=True)
    updated = await update_work_order(session, wo, payload)

    # Handle estimated hours: manual override vs auto re-matching
    if "estimated_hours" in payload:
        # Explicit override — set directly
        updated.estimated_hours = payload["estimated_hours"]
        await session.commit()
        await session.refresh(updated)
    elif "job_type" in payload:
        # Estimate-relevant field changed — re-run matching
        wrap_coverage = None
        if updated.wrap_details:
            wrap_detail = updated.wrap_details[0] if updated.wrap_details else None
            if wrap_detail and wrap_detail.wrap_coverage:
                wrap_coverage = (
                    wrap_detail.wrap_coverage.value
                    if hasattr(wrap_detail.wrap_coverage, "value")
                    else wrap_detail.wrap_coverage
                )
        vehicle_count = len(updated.work_order_vehicles or [])
        vehicle_type = extract_vehicle_type(updated.work_order_vehicles or [])
        match = await find_matching_estimates(
            session,
            user.organization_id,
            job_type=(
                updated.job_type.value
                if hasattr(updated.job_type, "value")
                else updated.job_type
            ),
            vehicle_count=vehicle_count,
            wrap_coverage=wrap_coverage,
            vehicle_type=vehicle_type,
        )
        if match:
            design_hrs = match.design_hours or Decimal(0)
            prod_hrs = (match.production_hours or Decimal(0)) * max(vehicle_count, 1)
            inst_hrs = (match.install_hours or Decimal(0)) * max(vehicle_count, 1)
            updated.estimated_hours = design_hrs + prod_hrs + inst_hrs
            if updated.design_details and match.design_hours is not None:
                updated.design_details.estimated_hours = match.design_hours
            if updated.production_details and match.production_hours is not None:
                updated.production_details.estimated_hours = match.production_hours
            if updated.install_details and match.install_hours is not None:
                updated.install_details.estimated_hours = match.install_hours
            await session.commit()
            await session.refresh(updated)

    return _to_response(updated)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test ARGS="-k 'test_estimate_rematching' -v" 2>&1 | tail -20`
Expected: All 3 PASS

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test 2>&1 | tail -20`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/work_orders.py backend/tests/test_services/test_estimate_rematching.py
git commit -m "feat: re-run estimate matching on PATCH, support manual override"
```

---

## Chunk 3: Frontend — Display estimated hours

### Task 6: Add estimated_hours to work order detail page

**Files:**
- Modify: `frontend/src/app/dashboard/work-orders/[id]/page.tsx`

- [ ] **Step 1: Add estimated_hours to WorkOrderDetail interface**

In `frontend/src/app/dashboard/work-orders/[id]/page.tsx`, add to the `WorkOrderDetail` interface (after line 49, after `updated_at: string;`):

```typescript
  estimated_hours: number | null;
```

- [ ] **Step 2: Update TimeEfficiencySection to accept and display estimated hours**

Replace the `TimeEfficiencySection` function signature (line 241) and its contents:

Replace:
```typescript
function TimeEfficiencySection({ timeLogs, jobValue }: { timeLogs: TimeLogEntry[]; jobValue: number }) {
  if (timeLogs.length === 0) return null;

  const actualHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);
```

With:
```typescript
function TimeEfficiencySection({ timeLogs, jobValue, estimatedHours }: { timeLogs: TimeLogEntry[]; jobValue: number; estimatedHours: number | null }) {
  if (timeLogs.length === 0 && estimatedHours == null) return null;

  const actualHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);
```

- [ ] **Step 3: Add Estimated Hours stat card and utilization bar**

In the same file, replace the summary row grid (the `<div className="grid grid-cols-3 gap-4">` block inside TimeEfficiencySection):

Replace:
```tsx
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Actual Hours</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">{actualHours.toFixed(1)}h</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Effective Rate</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">
            {effectiveRate != null ? `$${effectiveRate.toFixed(2)}/hr` : '--'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Time Entries</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">{timeLogs.length}</p>
        </div>
      </div>
```

With:
```tsx
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Estimated Hours</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">
            {estimatedHours != null ? `${estimatedHours}h` : '--'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Actual Hours</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">{actualHours.toFixed(1)}h</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Effective Rate</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">
            {effectiveRate != null ? `$${effectiveRate.toFixed(2)}/hr` : '--'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Time Entries</p>
          <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">{timeLogs.length}</p>
        </div>
      </div>

      {/* Utilization bar */}
      {estimatedHours != null && estimatedHours > 0 && actualHours > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--text-muted)]">Utilization</span>
            <span className={`font-mono font-medium ${
              (actualHours / estimatedHours) > 1 ? 'text-rose-500' :
              (actualHours / estimatedHours) >= 0.9 ? 'text-amber-500' :
              'text-emerald-500'
            }`}>
              {((actualHours / estimatedHours) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <div
              className={`h-full rounded-full transition-all ${
                (actualHours / estimatedHours) > 1 ? 'bg-rose-500' :
                (actualHours / estimatedHours) >= 0.9 ? 'bg-amber-500' :
                'bg-emerald-500'
              }`}
              style={{ width: `${Math.min((actualHours / estimatedHours) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
```

- [ ] **Step 4: Update the TimeEfficiencySection call site in OverviewTab**

Find where `<TimeEfficiencySection` is rendered in `OverviewTab` and add `estimatedHours` prop. Search for `<TimeEfficiencySection` and add the prop:

```tsx
<TimeEfficiencySection timeLogs={timeLogs} jobValue={wo.job_value} estimatedHours={wo.estimated_hours} />
```

- [ ] **Step 5: Build to verify no errors**

Run: `cd /Users/brewinvaz/repos/wrap-iq/frontend && npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/dashboard/work-orders/\[id\]/page.tsx
git commit -m "feat: display estimated hours and utilization bar in work order detail"
```

---

### Task 7: Add Est. Hours column to work order list page

**Files:**
- Modify: `frontend/src/app/dashboard/work-orders/page.tsx`

- [ ] **Step 1: Add estimated_hours to WorkOrder interface**

In `frontend/src/app/dashboard/work-orders/page.tsx`, add to the `WorkOrder` interface (after `updated_at: string;`):

```typescript
  estimated_hours: number | null;
```

- [ ] **Step 2: Add Est. Hours column**

In the `useWorkOrderColumns` function, add a new column object after the `value` column (after the closing `},` of the value column at line 135) and before the `due` column:

```typescript
    {
      key: 'est_hours',
      header: 'Est. Hours',
      className: 'font-mono text-[var(--text-secondary)]',
      render: (wo) => (wo.estimated_hours != null ? `${wo.estimated_hours}h` : '—'),
    },
```

- [ ] **Step 3: Build to verify no errors**

Run: `cd /Users/brewinvaz/repos/wrap-iq/frontend && npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/work-orders/page.tsx
git commit -m "feat: add Est. Hours column to work order list table"
```

---

## Chunk 4: Final verification

### Task 8: Run full test suite and verify

- [ ] **Step 1: Run full backend test suite**

Run: `cd /Users/brewinvaz/repos/wrap-iq && make test 2>&1 | tail -30`
Expected: All PASS

- [ ] **Step 2: Run full frontend build**

Run: `cd /Users/brewinvaz/repos/wrap-iq/frontend && npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Final commit if any fixups needed**

Only if previous steps required fixes.
