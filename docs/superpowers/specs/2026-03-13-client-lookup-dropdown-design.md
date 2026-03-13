# Client Lookup Dropdown Design

**Date**: 2026-03-13
**Issue**: Client dropdown in work order creation form is empty — frontend requests `limit=500` but backend rejects values > 100 with a 422, which the frontend silently swallows.
**Approach**: Dedicated lightweight lookup endpoint + searchable combobox component.

## Problem

1. `JobPricingTab` fetches `/api/clients?limit=500`
2. Backend `GET /api/clients` has `limit: int = Query(50, ge=1, le=100)` — FastAPI returns 422 for `limit=500`
3. Frontend `.catch(() => {})` silently discards the error, leaving clients array empty
4. Additionally, the existing endpoint eagerly loads `work_orders` via `selectinload` — wasteful for a dropdown that only needs `id` and `name`
5. With potentially thousands of clients per org, loading all into a static dropdown is not viable

## Design

### Backend: New Lookup Endpoint

**Route**: `GET /api/clients/lookup`

> **Important**: This route must be registered **before** `GET /api/clients/{client_id}` in the router file to avoid FastAPI trying to parse `"lookup"` as a UUID.

**Query parameters**:
- `search` (str, optional, max_length=100) — case-insensitive substring match on client name via `ILIKE`. Whitespace-only values are treated as empty/omitted.
- `limit` (int, default=25, ge=1, le=50) — max results returned

**Behavior**:
- Filters to `is_active=True` clients only
- Scoped to the authenticated user's `organization_id`
- No `selectinload` — simple query returning only `id` and `name`
- If `search` is empty/omitted, returns the first 25 clients ordered by name (so dropdown isn't empty on open)
- If `search` is provided, escapes `%` and `_` wildcards in the user input before constructing the ILIKE pattern (e.g., `search.replace("%", r"\%").replace("_", r"\_")`) then filters with `Client.name.ilike(f"%{escaped}%")`
- Orders results alphabetically by name

**New schemas** (in `app/schemas/clients.py`):
- `ClientLookupItem`: `id: UUID`, `name: str`
- `ClientLookupResponse`: `items: list[ClientLookupItem]`

**New service method** (in `app/services/clients.py`):
- `lookup(org_id, search, limit)` — lightweight query, no joins

### Frontend: Combobox Component

**New component**: `frontend/src/components/ui/Combobox.tsx`

**Props** (compatible with Select where possible):
- `value: string` — selected option value
- `onChange: (value: string) => void`
- `onSearch: (query: string) => Promise<SelectOption[]>` — async search function
- `placeholder?: string`
- `id?: string`
- `className?: string`
- `error?: boolean`
- `disabled?: boolean`
- `size?: 'sm' | 'md'`
- `debounceMs?: number` (default: 300)
- `selectedLabel?: string` — label for the currently selected value (for when the component mounts with a pre-existing value that isn't in the initial search results)

**Behavior**:
- Text input triggers debounced `onSearch` calls
- On focus/open (before typing), calls `onSearch('')` to load initial results
- Dropdown panel rendered via `createPortal` (same as Select)
- Arrow keys navigate, Enter selects, Escape closes
- Shows selected option's label in the input when not actively searching; falls back to `selectedLabel` prop if the value isn't in current results
- Loading spinner while fetching
- Stale responses are discarded: if the user types new input before a prior request resolves, the prior response is ignored (same `cancelled` flag pattern used elsewhere in the codebase)
- On `onSearch` rejection, shows an inline "Failed to load" message instead of silently swallowing the error

**Accessibility**: Uses `role="combobox"` on the input and `role="listbox"` on the dropdown panel, with `aria-activedescendant`, `aria-expanded`, and `aria-controls` per WAI-ARIA combobox pattern.

**Visual style**: Matches existing Select component (same border, focus ring, sizing, portal dropdown).

### Frontend: Update JobPricingTab

Replace the `Select` + `useEffect` fetch pattern with:
- A `searchClients` async function that calls `GET /api/clients/lookup?search=<term>&limit=25`
- The new `Combobox` component wired to `searchClients`
- Remove the `clients` state array and the `useEffect` that fetches all clients
- Errors from the API call are propagated to the Combobox (not silently caught)

## Files Changed

| File | Change |
|------|--------|
| `backend/app/schemas/clients.py` | Add `ClientLookupItem`, `ClientLookupResponse` |
| `backend/app/services/clients.py` | Add `lookup()` method |
| `backend/app/routers/clients.py` | Add `GET /api/clients/lookup` endpoint (before `/{client_id}` route) |
| `frontend/src/components/ui/Combobox.tsx` | New searchable combobox component |
| `frontend/src/components/work-orders/wizard/JobPricingTab.tsx` | Replace Select with Combobox |
| `backend/tests/` | Tests for the new lookup endpoint |

## Testing

### Backend
- Lookup with no search term returns first 25 active clients ordered by name
- Lookup with search term filters by name (case-insensitive)
- Inactive clients are excluded from results
- Results are scoped to the authenticated user's organization
- Limit parameter is respected
- Search with ILIKE wildcards (`%`, `_`) in input are escaped properly
- Whitespace-only search is treated as empty

### Frontend
- Combobox renders with placeholder when no value selected
- Displays selected client name after selection
- Shows loading spinner during search
- Debounces input (no API call on every keystroke)
- Displays search results in dropdown
- Keyboard navigation: ArrowDown/Up moves, Enter selects, Escape closes
- Shows error state when API call fails
- Stale responses from superseded searches are discarded
- Mounts correctly with pre-existing `clientId` using `selectedLabel`
