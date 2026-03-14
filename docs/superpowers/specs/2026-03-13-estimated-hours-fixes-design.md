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

**Vehicle type strategy:** Use the first vehicle's type when all vehicles share the same type; pass `None` when types are mixed or no vehicles exist.

## Backend Changes

### 1. Extract vehicle_type helper

Add a helper function in `work_orders.py` (or `estimate_matching.py`) that takes a list of vehicles and returns the shared `vehicle_type` string if all vehicles have the same type, or `None` if mixed/empty.

### 2. Fix creation auto-fill (`POST /api/work-orders`)

**File:** `backend/app/routers/work_orders.py`, lines 218-247

- After the work order is created and vehicles are associated, extract `vehicle_type` using the helper.
- Pass it to `find_matching_estimates` instead of the current hardcoded `None`.

### 3. Add estimated_hours to WorkOrderUpdate schema

**File:** `backend/app/schemas/work_orders.py`, `WorkOrderUpdate` class

- Add `estimated_hours: Decimal | None = None` as an optional field.

### 4. Re-run estimate matching on PATCH

**File:** `backend/app/routers/work_orders.py`, PATCH handler (~line 290)

After applying the update:

1. If `estimated_hours` was explicitly provided in the payload, set it directly on `wo.estimated_hours` (manual override). Skip auto-matching.
2. If `estimated_hours` was NOT in the payload, check if any estimate-relevant fields were in the update (`job_type`). If so:
   - Extract current `wrap_coverage` from `wo.wrap_details`
   - Extract `vehicle_type` from `wo.work_order_vehicles`
   - Count vehicles
   - Call `find_matching_estimates` and update hours (same logic as creation)
   - If no rule matches, leave hours unchanged (don't null them out)

### 5. Expose vehicle_type in VehicleInWorkOrder schema

**File:** `backend/app/schemas/work_orders.py`, `VehicleInWorkOrder` class

- Add `vehicle_type: str | None` field.
- Update `_to_response` in the router to include `vehicle_type` from the vehicle model.

## Frontend Changes

### 6. Work Order Detail Page — TimeEfficiencySection

**File:** `frontend/src/app/dashboard/work-orders/[id]/page.tsx`

- Add `estimated_hours` to the `WorkOrderDetail` TypeScript interface.
- Add an "Estimated Hours" stat card as the first card in the row (before Actual Hours).
- Add a utilization progress bar below the stat cards: `actual / estimated` with percentage. Color: green (<90%), amber (90-100%), red (>100%). Hidden when `estimated_hours` is null.
- Show per-phase estimated hours alongside actual hours in the phase breakdown section. The data is already available in `design_details.estimated_hours`, `production_details.estimated_hours`, `install_details.estimated_hours`.

### 7. Work Order List Page — Est. Hours Column

**File:** `frontend/src/app/dashboard/work-orders/page.tsx`

- Add `estimated_hours` and `actual_hours` to the `WorkOrder` TypeScript interface.
- Add an "Est. Hours" column to the DataTable, positioned after "Value" and before "Due".
- Display the number or "—" if null. No progress bar in list view.

## Testing

### Backend Tests

- **Estimate matching on creation:** Verify `vehicle_type` is passed and rules with `vehicle_type` filters now match.
- **Estimate re-matching on PATCH:** Verify changing `job_type` triggers recalculation. Verify explicit `estimated_hours` in payload sets the value directly. Verify a PATCH with no estimate-relevant fields does not recalculate.
- **Vehicle type extraction:** Test all-same-type returns that type, mixed returns `None`, empty returns `None`.

### Frontend

No dedicated tests — changes are display-only wiring of existing API fields.

## Files to Modify

| File | Change |
|------|--------|
| `backend/app/routers/work_orders.py` | Fix creation auto-fill, add PATCH re-matching, vehicle_type helper, update `_to_response` |
| `backend/app/schemas/work_orders.py` | Add `estimated_hours` to `WorkOrderUpdate`, `vehicle_type` to `VehicleInWorkOrder` |
| `frontend/src/app/dashboard/work-orders/[id]/page.tsx` | Enhance TimeEfficiencySection with estimated hours display |
| `frontend/src/app/dashboard/work-orders/page.tsx` | Add Est. Hours column |
| `backend/tests/` | New tests for re-matching and vehicle_type extraction |
