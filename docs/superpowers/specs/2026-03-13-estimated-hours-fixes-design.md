# Estimated Hours Fixes — Design Spec

## Problem

Three gaps exist in the estimated hours system:

1. **vehicle_type not passed to estimate matcher** — The `POST /api/work-orders` handler calls `find_matching_estimates` with `vehicle_type=None`, so EstimateDefaults rules that filter on vehicle_type never match.
2. **PATCH doesn't re-run estimate matching** — Changing `job_type`, vehicles, or `wrap_coverage` after creation leaves `estimated_hours` stale.
3. **No manual override** — `WorkOrderUpdate` schema has no `estimated_hours` field, so hours can't be corrected via the API.

Additionally, `estimated_hours` is returned by the API but displayed nowhere in the UI.

## Approach

**Approach B: Auto-recalculate always, manual override replaces.**

- If `estimated_hours` is explicitly provided in a PATCH, use it directly (manual override).
- If not provided but estimate-relevant fields changed, re-run auto-matching (overwrites previous value).
- No extra tracking column needed.
- **Override detection:** Use `data.model_dump(exclude_unset=True)` and check `"estimated_hours" in payload_dict` to distinguish explicit `null` from omitted.

**Vehicle type strategy:** Use the first vehicle's type when all vehicles share the same type; pass `None` when types are mixed or no vehicles exist.

## Backend Changes

### 1. Extract vehicle_type helper

Add a helper function in `estimate_matching.py` that takes a list of `WorkOrderVehicle` objects (with loaded `.vehicle` relationships) and returns the shared `vehicle_type` value string if all vehicles share the same type, or `None` if mixed/empty.

**Ordering note:** At creation time, this helper must be called AFTER `create_work_order` returns, since `wo.work_order_vehicles` is only populated after the work order and vehicle associations are flushed.

### 2. Fix creation auto-fill (`POST /api/work-orders`)

**File:** `backend/app/routers/work_orders.py`, lines 218-247

- After the work order is created and vehicles are associated, extract `vehicle_type` from `wo.work_order_vehicles` using the helper.
- Pass it to `find_matching_estimates` instead of the current hardcoded `None`.

### 3. Add estimated_hours to WorkOrderUpdate schema

**File:** `backend/app/schemas/work_orders.py`, `WorkOrderUpdate` class

- Add `estimated_hours: Decimal | None = None` as an optional field.

### 4. Re-run estimate matching on PATCH

**File:** `backend/app/routers/work_orders.py`, PATCH handler (~line 290)

After applying the update via `update_work_order`:

1. If `"estimated_hours" in payload_dict` (explicitly provided, even if `null`), set `wo.estimated_hours` directly (manual override). Skip auto-matching.
2. If `"estimated_hours"` was NOT in the payload, check if any estimate-relevant fields were in the update (`job_type`, `wrap_coverage` via wrap_details). If so:
   - Extract current `wrap_coverage` from `wo.wrap_details[0].wrap_coverage if wo.wrap_details else None` (note: `wrap_details` is a **list** relationship)
   - Extract `vehicle_type` from `wo.work_order_vehicles` using the helper
   - Count vehicles via `len(wo.work_order_vehicles)`
   - Call `find_matching_estimates` and update hours (same logic as creation)
   - If no rule matches, leave hours unchanged (don't null them out)
3. Call `await session.commit()` and `await session.refresh(wo)` to persist re-matched hours (mirrors the creation handler pattern).

### 5. Add estimated_hours to ProductionDetailsResponse and InstallDetailsResponse

**File:** `backend/app/schemas/production_details.py`, `ProductionDetailsResponse` class
**File:** `backend/app/schemas/install_details.py`, `InstallDetailsResponse` class

- Add `estimated_hours: Decimal | None = None` to both schemas.
- The underlying model columns already exist (added in migration 019), but the response schemas currently omit them. This is required for the frontend to display per-phase estimated hours.

### 6. Expose vehicle_type in VehicleInWorkOrder schema

**File:** `backend/app/schemas/work_orders.py`, `VehicleInWorkOrder` class

- Add `vehicle_type: str | None` field.
- **Note:** `vehicle_type` on the `Vehicle` model is a `VehicleType` StrEnum, which serializes cleanly to string.
- Update `_to_response` in the router to include `vehicle_type` from `wov.vehicle.vehicle_type` in the vehicles dict.

## Frontend Changes

### 7. Work Order Detail Page — TimeEfficiencySection

**File:** `frontend/src/app/dashboard/work-orders/[id]/page.tsx`

- Add `estimated_hours` to the `WorkOrderDetail` TypeScript interface.
- Add an "Estimated Hours" stat card as the first card in the row (before Actual Hours).
- Add a utilization progress bar below the stat cards: `actual / estimated` with percentage. Color: green (<90%), amber (90-100%), red (>100%). Hidden when `estimated_hours` is null.
- Show per-phase estimated hours alongside actual hours in the phase breakdown section. Data comes from `design_details.estimated_hours`, `production_details.estimated_hours`, `install_details.estimated_hours` (after backend schema fix in step 5).

### 8. Work Order List Page — Est. Hours Column

**File:** `frontend/src/app/dashboard/work-orders/page.tsx`

- Add `estimated_hours` to the `WorkOrder` TypeScript interface.
- Add an "Est. Hours" column to the DataTable, positioned after "Value" and before "Due".
- Display the number or "—" if null. No progress bar in list view.
- **Note:** `actual_hours` is only computed in the `GET /{id}` detail endpoint, not the list endpoint. The list page will only show `estimated_hours`, not actual. This is acceptable — the detail page provides the full comparison.

## Testing

### Backend Tests

- **Estimate matching on creation:** Verify `vehicle_type` is passed and rules with `vehicle_type` filters now match.
- **Estimate re-matching on PATCH:** Verify changing `job_type` or `wrap_coverage` triggers recalculation. Verify explicit `estimated_hours` in payload sets the value directly. Verify a PATCH with no estimate-relevant fields does not recalculate.
- **Vehicle type extraction:** Test all-same-type returns that type, mixed returns `None`, empty returns `None`.

### Frontend

No dedicated tests — changes are display-only wiring of existing API fields.

## Files to Modify

| File | Change |
|------|--------|
| `backend/app/routers/work_orders.py` | Fix creation auto-fill, add PATCH re-matching, vehicle_type helper, update `_to_response` |
| `backend/app/schemas/work_orders.py` | Add `estimated_hours` to `WorkOrderUpdate`, `vehicle_type` to `VehicleInWorkOrder` |
| `backend/app/schemas/production_details.py` | Add `estimated_hours` to `ProductionDetailsResponse` |
| `backend/app/schemas/install_details.py` | Add `estimated_hours` to `InstallDetailsResponse` |
| `backend/app/services/estimate_matching.py` | Add `extract_vehicle_type` helper |
| `frontend/src/app/dashboard/work-orders/[id]/page.tsx` | Enhance TimeEfficiencySection with estimated hours display |
| `frontend/src/app/dashboard/work-orders/page.tsx` | Add Est. Hours column |
| `backend/tests/` | New tests for re-matching and vehicle_type extraction |
