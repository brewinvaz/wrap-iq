# Work Order Detail Page & Delete Functionality

## Summary

Add a work order detail page at `/dashboard/work-orders/[id]` that surfaces all captured work order data, and implement hard-delete functionality accessible from both the list and detail pages. Work orders with linked invoices cannot be deleted.

## Backend Changes

### DELETE Endpoint

**Route:** `DELETE /api/work-orders/{work_order_id}`

**Logic:**
1. Verify work order exists and belongs to the user's organization (existing tenant pattern)
2. Check for linked invoices — if any exist, return `409 Conflict` with body `{"detail": "Cannot delete work order with linked invoices"}`
3. Delete associated R2 objects (best-effort — if R2 is unavailable, proceed with DB deletion):
   - `file_uploads` R2 keys
   - `renders` R2 keys (`vehicle_photo_key`, `wrap_design_key`, `result_image_key`)
4. Cascade-delete dependent records in order:
   - `file_uploads`
   - `time_logs`
   - `estimate_line_items`
   - `estimates`
   - `renders`
   - `wrap_details`
   - `design_details`
   - `production_details`
   - `install_time_logs` (child of `install_details`)
   - `install_details`
   - `work_order_vehicles`
   - The work order itself
5. Return `204 No Content`

**Error Responses:**
- `404 Not Found` — work order does not exist or belongs to another org
- `409 Conflict` — work order has linked invoices

### Extend GET Endpoint Response

Add `status_timestamps` to `WorkOrderResponse` schema so the Timeline tab can render it. The field is already stored on the model but not currently exposed in the response.

**`status_timestamps` structure:** `dict[str, str]` mapping kanban stage UUID (as string) → ISO 8601 timestamp. Written by `update_status` service when a work order moves between stages.

## Frontend Changes

### Work Order Detail Page

**Route:** `/dashboard/work-orders/[id]/page.tsx`

**Pattern:** Follow the existing Projects detail page (`/dashboard/projects/[id]/page.tsx`) for layout, styling, and component structure.

**Layout:**
```
Header (fixed)
├─ Back link ("← Work Orders")
├─ Job Number (WO-0001) + Status pill (colored by kanban stage)
├─ Priority badge (High/Medium/Low)
└─ Action buttons: [Delete]

Tab Navigation
├─ Overview
├─ Checklist
├─ Photos
└─ Timeline

Content Area (scrollable, per tab)
```

**Overview Tab:**
- Job Details card: Job Number, Job Type, Priority, Job Value (formatted as currency)
- Client & Vehicle card: Client Name, Vehicle(s) listed as "Year Make Model — VIN"
- Dates card: Date In, Estimated Completion, Completion Date
- Internal Notes card: Notes text (read-only)

**Checklist Tab:**
- Render checklist items with checkboxes showing label and done status
- Read-only display

**Photos Tab:**
- Fetch from `GET /api/work-orders/{id}/photos`
- Display as grid, grouped by type (before vs after)
- Handle 503 gracefully (R2 not configured) — show "Photos are not available in this environment"

**Timeline Tab:**
- Render `status_timestamps` as a vertical timeline
- Each entry shows stage name, stage color, and timestamp

**States:**
- Loading: skeleton components
- Error: error message with retry button
- Empty: contextual empty state per tab

### List Page Updates

**Row click:** Make each row in the work orders table clickable, navigating to `/dashboard/work-orders/{id}`.

**Action menu:** Add a "..." menu to each row with a "Delete" option.

**Delete confirmation modal:** "Are you sure you want to delete WO-XXXX? This action cannot be undone."
- On confirm: call `api.delete(`/api/work-orders/${id}`)`, remove row from local state, show success toast
- On 409 error: show "Cannot delete — this work order has linked invoices"

### Detail Page Delete

- Delete button in the header area
- Same confirmation modal and error handling as list page
- On success: navigate to `/dashboard/work-orders`

## Testing

### Backend Tests
- `DELETE /api/work-orders/{id}` — successful deletion cascades all dependent records
- Invoice guard returns `409` when invoices are linked
- `404` for non-existent work order
- Tenant isolation — cannot delete another organization's work order

## Files to Create/Modify

### Create
- `frontend/src/app/dashboard/work-orders/[id]/page.tsx` — detail page

### Modify
- `backend/app/routers/work_orders.py` — add DELETE endpoint
- `backend/app/schemas/work_orders.py` — add `status_timestamps` to `WorkOrderResponse`
- `frontend/src/app/dashboard/work-orders/page.tsx` — add row click navigation and delete action menu
- `backend/tests/` — add delete endpoint tests
