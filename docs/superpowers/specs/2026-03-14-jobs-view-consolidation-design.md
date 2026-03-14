# Jobs View Consolidation Design

**Date:** 2026-03-14
**Status:** Draft

## Summary

Consolidate the Job Board (`/dashboard`) and Jobs List (`/dashboard/work-orders`) into a single unified page at `/dashboard`. The Job Board becomes the sole jobs hub, with its list view mode upgraded to absorb all features from the standalone Jobs List page. The CSV import flow moves from a dedicated route to an inline modal. The work order detail page moves from `/dashboard/work-orders/[id]` to `/dashboard/jobs/[id]`.

## Goals

- Single entry point for all job management at `/dashboard`
- Search, CSV import, and filters available in all view modes
- No feature regression from the current Jobs List page
- Minimal changes to existing kanban behavior

## Non-Goals

- Changing backend API endpoints
- Adding new filtering capabilities beyond what exists today
- Server-side pagination for kanban mode

## Known Limitations

- The kanban path fetches `limit=100` work orders. Organizations with more than 100 jobs will have incomplete kanban views and KPI metrics. This is a pre-existing limitation, not introduced by this consolidation. Do not attempt to fix it as part of this work.

## Approach

Enhance the existing `/dashboard/page.tsx` in-place. Add the missing features (search, status tabs, pagination, CSV import modal, delete confirmation) directly to the page, with the list view mode receiving the bulk of upgrades. This is the smallest diff that achieves full consolidation.

## Architecture

### Toolbar (shared across Kanban and List modes)

The header bar gains:

- **Search input** — debounced (300ms), visible in both modes
  - Kanban: filters cards client-side by job number or client name (composes with existing quick filters and dropdown filters using AND logic)
  - List: sends `search` query param to server
  - The "X total" badge in the header always shows the unfiltered total count (not affected by search or filters)
- **Import CSV button** — opens `ImportCSVModal` (replaces route-based import)
- **Filter dropdown** — existing (priority, job type, status). In kanban mode, applied client-side. In list mode, priority and job type filters are applied client-side to the server-returned results (the backend API does not accept these params). Only `status_id` and `search` go server-side.
- **+ New Job button** — existing

### KPI Metrics Bar

The KPI metrics bar renders above both kanban and list views, outside the view-mode conditional. It is always computed from the kanban data path (which always runs on mount regardless of view mode). Switching to list mode does not affect KPI display.

### View Modes

**Kanban** (unchanged):
- Drag-and-drop columns with optimistic updates
- Client-side filtering via quick filters + dropdown + search (all AND-composed)

**List** (upgraded):
- Status tabs across top: "All" + one per kanban stage (server-side `status_id` filtering)
- Full column set: Job #, Client, Vehicle, Type, Priority, Status, Value, Est. Hours, Due, Actions (delete)
- Row click navigates to `/dashboard/jobs/[id]` — delete button uses `e.stopPropagation()` to prevent row navigation
- Pagination: 20 items per page, Previous/Next controls with "Showing X-Y of Z" text
- Delete per row with confirmation modal (same pattern as current work-orders page, including 409 invoice-linked error handling)

**Calendar** (unchanged):
- Links to `/dashboard/calendar`

### Data Fetching

Two independent data paths based on view mode:

**Kanban path** (existing, unchanged):
- Fetches all work orders (`limit=100`) + kanban stages on mount
- Always runs regardless of view mode (needed for KPI computation)
- Client-side filtering

**List path** (new):
- Triggered by changes to `activeStage`, `debouncedSearch`, or `page`
- Server-side query: `GET /api/work-orders?skip={page*20}&limit=20&status_id={activeStage}&search={debouncedSearch}`
- Independent state: `listWorkOrders`, `listTotal`, `listLoading`
- Client-side post-filtering for priority and job type dropdown filters (AND-composed with server results)

**Shared data:**
- `stages` — fetched once, used by both kanban columns and list status tabs
- KPI metrics — always computed from kanban data

### State Management

**Shared state:**
- `viewMode`: kanban | list | calendar
- `stages`: KanbanStageResponse[] (fetched once)
- `showCreateModal`, `showImportModal`: boolean
- `filterCriteria` + `filter` (quick filters)
- `search`, `debouncedSearch`: string
- KPI metrics

**List-only state:**
- `activeStage`: string | null (selected status tab)
- `page`: number (pagination offset)
- `listWorkOrders`: WorkOrder[]
- `listTotal`: number
- `listLoading`: boolean
- `showDeleteModal`, `deleteTarget`, `deleting`, `deleteError`

**Search behavior by mode:**
- Kanban: client-side filter matching job number or client name against cards, AND-composed with quick filters and dropdown filters
- List: `search` param sent to server API

## Component Changes

### Modified Files

1. **`frontend/src/app/dashboard/page.tsx`**
   - Add `estimated_hours` field to the `WorkOrderResponse` interface (currently missing; needed for Est. Hours column)
   - Add search input to header (debounced, 300ms)
   - Add Import CSV button to header (opens modal)
   - Add list-specific data fetching (paginated, server-side search/filter)
   - Upgrade `ListView` component:
     - Richer columns: add Est. Hours, Due (formatted), Actions (delete button with `e.stopPropagation()`)
     - `onRowClick` handler navigating to `/dashboard/jobs/[id]`
     - Status tabs above table (All + per-stage buttons)
     - Pagination controls below table (Previous/Next + "Showing X-Y of Z")
   - Add delete confirmation modal (port from work-orders page, including 409 error handling)
   - Add search filtering for kanban cards (client-side, AND-composed with existing filters)

2. **`frontend/src/lib/roles.ts`**
   - Admin: remove "Jobs List" (`/dashboard/work-orders`) nav entry, rename "Jobs Board" to "Jobs"
   - Production: update "Assigned Jobs" href from `/dashboard/jobs` to `/dashboard` (currently a dead link; after consolidation, production workers land on the unified page)

3. **`frontend/src/app/dashboard/work-orders/[id]/page.tsx`** → move to **`frontend/src/app/dashboard/jobs/[id]/page.tsx`**
   - Update back-links: any `Link href` or `router.push` referencing `/dashboard/work-orders` → `/dashboard`
   - Check for breadcrumb navigation and update accordingly

### New Files

4. **`frontend/src/components/work-orders/ImportCSVModal.tsx`**
   - Extracted from `/dashboard/work-orders/import/page.tsx`
   - Same 4-step flow: select → preview → uploading → done
   - Preserves the "Download Template" button (fetches `/api/csv-upload/template`)
   - Carries over the `uploadFormData` helper function which uses raw `fetch` with `FormData` (bypasses the standard `api` client). Requires `API_BASE_URL` and `getAccessToken` imports.
   - Rendered as fixed overlay modal (same pattern as `CreateWorkOrderModal`)
   - "Done" step: "Close" button closes modal + triggers `fetchData()` refresh. "Import Another File" resets to select step within modal.
   - No backend API changes

### Removed Files

5. `frontend/src/app/dashboard/work-orders/page.tsx`
6. `frontend/src/app/dashboard/work-orders/import/page.tsx`
7. `frontend/src/app/dashboard/work-orders/[id]/page.tsx` (moved, not deleted outright)

## Route Changes

| Before | After |
|--------|-------|
| `/dashboard` (Job Board) | `/dashboard` (unified Jobs page) |
| `/dashboard/work-orders` (Jobs List) | Removed |
| `/dashboard/work-orders/import` (CSV import) | Removed (inline modal) |
| `/dashboard/work-orders/[id]` (Job detail) | `/dashboard/jobs/[id]` |

No redirects needed — the app is still in development.

## Testing

- Verify list view: status tab filtering, debounced search, pagination, row click to `/dashboard/jobs/[id]`
- Verify CSV import modal: open/close, file drag-drop, upload flow, template download, refresh on completion
- Verify delete confirmation modal from list view rows (including `e.stopPropagation()` preventing row navigation, and 409 invoice-linked error)
- Verify kanban unchanged: drag-drop status changes, KPI metrics, client-side filters
- Verify search works in both modes (client-side kanban with AND composition, server-side list)
- Verify KPI metrics bar visible in both kanban and list modes
- Verify dropdown filters (priority, job type) apply in both modes (client-side in both)
- Verify nav links in `roles.ts` resolve correctly for all roles
- Update any existing tests referencing `/dashboard/work-orders` routes
