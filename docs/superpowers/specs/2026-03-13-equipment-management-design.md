# Equipment Management — Design Spec

**Issue:** #476
**Date:** 2026-03-13
**Scope:** Database model, API, Equipment page UI, and Work Order wizard integration

---

## Overview

Build Equipment Management from scratch — an Equipment model for tracking shop inventory (printers, laminators, plotters, and other equipment), CRUD API, an Equipment page for managing equipment, and integration with the Production tab of the work order wizard.

## Database

### Equipment Model

New model in `backend/app/models/equipment.py`:

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, default uuid4 |
| `organization_id` | UUID | FK → organizations.id, indexed (via TenantMixin) |
| `name` | String(255) | NOT NULL |
| `serial_number` | String(255) | nullable |
| `equipment_type` | Enum(EquipmentType) | NOT NULL |
| `is_active` | Boolean | NOT NULL, default True |
| `created_at` | DateTime | via TimestampMixin |
| `updated_at` | DateTime | via TimestampMixin |

**EquipmentType enum** (StrEnum): `printer`, `laminator`, `plotter`, `other`

Use `Enum(EquipmentType, values_callable=lambda e: [m.value for m in e])` for the column definition, matching the existing pattern (e.g., `ClientType` in `client.py`).

### ProductionDetails Changes

Replace the existing `assigned_equipment: String(255)` column with three FK columns:

| Column | Type | Constraints |
|--------|------|-------------|
| `printer_id` | UUID | FK → equipment.id, nullable |
| `laminator_id` | UUID | FK → equipment.id, nullable |
| `plotter_id` | UUID | FK → equipment.id, nullable |

Relationships on ProductionDetails: `.printer`, `.laminator`, `.plotter` → Equipment (many-to-one).

### Migration

**Chain from current Alembic head.** Run `alembic heads` at implementation time to determine the correct `down_revision`. Use the next sequential number if the head is numeric (e.g., `019`), or generate a revision ID if the head is a hash.

Steps:
1. Create `equipment` table
2. Add `printer_id`, `laminator_id`, `plotter_id` to `production_details`
3. Drop `assigned_equipment` column from `production_details`

**Data migration strategy:** Existing `assigned_equipment` values are empty strings or free-text with no structured mapping to equipment records. Data loss is acceptable — the column is dropped with no attempt to migrate values. The `downgrade()` must restore `assigned_equipment` as `String(255), nullable=True` but data will not be recoverable.

### Registration

- Import `Equipment` in `backend/app/models/__init__.py`
- Register the new router in `backend/app/main.py` via `app.include_router()`

## API

### Equipment CRUD

Router: `backend/app/routers/equipment.py`, prefix `/api/equipment`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create equipment |
| `GET` | `/` | List with `search`, `equipment_type`, `is_active`, `skip`, `limit` params |
| `GET` | `/stats` | Returns `{total, active, printers, other}` |
| `GET` | `/{id}` | Get single equipment |
| `PATCH` | `/{id}` | Update equipment |
| `DELETE` | `/{id}` | Hard delete (409 if referenced by production_details) |

**Behaviors:**
- All endpoints scoped to `user.organization_id`
- Search: case-insensitive ILIKE on `name` and `serial_number`
- Type filter: exact match on `equipment_type` enum
- Active filter: `is_active` boolean query param (used by Production tab to fetch only active equipment)
- Delete: hard delete, returns 409 Conflict if equipment is assigned to any production_details record (via `printer_id`, `laminator_id`, or `plotter_id`). Deactivate via PATCH instead if equipment is in use.
- Stats: `total` = all equipment, `active` = where is_active=True, `printers` = where type=printer, `other` = where type=other

### Service Layer

`backend/app/services/equipment.py` — class `EquipmentService` with `__init__(session)`, methods: `create`, `list`, `get`, `update`, `delete`, `get_stats`. Follows the `ClientService` pattern.

### Schemas

`backend/app/schemas/equipment.py`:

- `EquipmentCreate`: name (required), serial_number (optional), equipment_type (required), is_active (default True)
- `EquipmentUpdate`: all fields optional (exclude_unset)
- `EquipmentResponse`: all fields + id, created_at, updated_at (excludes organization_id for security)
- `EquipmentListResponse`: items list + total count
- `EquipmentStats`: total, active, printers, other

### ProductionDetails Schema Changes

Update `ProductionDetailsCreate` in `backend/app/schemas/production_details.py`:
- Remove `assigned_equipment`
- Add `printer_id: uuid.UUID | None = None`, `laminator_id: uuid.UUID | None = None`, `plotter_id: uuid.UUID | None = None`

Create `ProductionDetailsUpdate` (does not currently exist):
- Same fields as `ProductionDetailsCreate`, all optional

Update `ProductionDetailsResponse`:
- Remove `assigned_equipment`
- Add `printer_id`, `laminator_id`, `plotter_id` (all UUID | None)

**FK validation** lives in the work orders router/service (where ProductionDetails are created/updated), not in the equipment router. Validation checks:
1. Referenced equipment belongs to the same org
2. Equipment type matches the slot (e.g., `printer_id` must reference equipment with `type=printer`)

## Frontend — Equipment Page

**Location:** Component at `frontend/src/components/equipment/EquipmentPage.tsx`, rendered by the existing `frontend/src/app/dashboard/equipment/page.tsx` (currently a placeholder). The route stays at `/dashboard/equipment` — it's already wired into the sidebar for Installer and Production roles in `frontend/src/lib/roles.ts`.

### Layout

Two-panel layout matching the Clients pattern:
- **Left panel:** Scrollable equipment list with selection highlight
- **Right panel:** Detail view for selected equipment

### Header
- Title: "Equipment Management"
- Subtitle: "Manage your shop equipment inventory and track usage"
- "+ Add Equipment" button (primary)

### Search & Filter Bar
- Search input: filters by name or serial number (real-time)
- Type filter dropdown (Select component): All Types, Printer, Laminator, Plotter, Other

### Equipment List (Left Panel)
- Each item shows: name (bold), type + serial number (subtitle), active/inactive badge
- Selected item highlighted with accent border
- Sorted by created_at descending
- No pagination — fetch all (equipment count per org will be small, typically < 50)

### Detail Panel (Right Panel)
- Equipment name as heading, "Added [date]" subtitle
- Edit button (opens Add/Edit modal pre-filled) and Delete button (with confirmation)
- Info grid (2x2): Equipment Type, Serial Number, Status, Assigned Jobs count
- Empty state when nothing selected: "Select equipment to view details"

### Stats Cards (Bottom)
- 4-card grid: Total Equipment, Active Equipment, Printers, Other Equipment
- Icons + count, always visible, updates on CRUD operations

### Empty State
- Gear icon, "No Equipment Added" heading
- "Start by adding your first piece of equipment to track usage on work orders."
- "+ Add First Equipment" CTA button (opens Add modal)

### Add/Edit Equipment Modal
- Reusable modal for create and edit
- Fields: Equipment Name (required), Serial Number (optional), Equipment Type (required, Select dropdown), "Equipment is active and available" checkbox
- Cancel and Create/Save buttons

### API Layer
`frontend/src/lib/api/equipment.ts`:
- `fetchEquipment(search?, type?, isActive?)` → list
- `fetchEquipmentStats()` → stats
- `createEquipment(data)` → equipment
- `updateEquipment(id, data)` → equipment
- `deleteEquipment(id)` → void
- Snake_case → camelCase mapping (matching existing pattern)

### State Management
- `useState` + `useCallback` + `useEffect` pattern (matching existing pages)
- States: equipment list, selected equipment, loading, error, modal open, stats

### Theming
- All styling uses existing CSS variables: `var(--surface-card)`, `var(--border)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`, `var(--accent-primary)`, `var(--surface-raised)`, etc.
- Uses existing custom components: `Button`, `Select`

## Frontend — Work Order Wizard Production Tab

### Changes

Replace the three static button groups (Printer, Laminator, Plotter/Cutter) with `Select` dropdowns:

- **Printer dropdown:** Lists active equipment where `type=printer`
- **Laminator dropdown:** Lists active equipment where `type=laminator`
- **Plotter/Cutter dropdown:** Lists active equipment where `type=plotter`

Each dropdown:
- Default option: "No [Type]" (maps to null)
- Options show equipment name
- Selected value maps to `printer_id` / `laminator_id` / `plotter_id` on the `ProductionDetailsCreate` schema

### ProductionState Type Changes

Update `frontend/src/components/work-orders/wizard/types.ts`:
- Change `printer: string` → `printerId: string` (UUID or empty string)
- Change `laminator: string` → `laminatorId: string`
- Change `plotterCutter: string` → `plotterId: string`
- Update `INITIAL_PRODUCTION` defaults accordingly

### Data Fetching
- Fetch active equipment by type on Production tab mount
- Use `GET /api/equipment?equipment_type=printer&is_active=true` (etc.)

### Remaining Sections Unchanged
- Print Media, Laminate, Window Perforation, Production Notes — no changes

## Testing

### Backend
- Equipment CRUD: create, list (with search/filter/is_active), get, update, delete
- Delete protection: verify 409 when equipment is referenced by production_details
- Stats endpoint accuracy (total, active, printers, other counts)
- Org scoping: verify equipment from org A is not visible to org B
- Type validation: verify printer_id rejects non-printer equipment
- Migration: verify up/down

### Frontend
- Equipment list rendering, search filtering, type filtering
- Add/Edit modal form validation
- Delete with confirmation
- Stats card updates after CRUD
- Empty state display
- Production tab dropdowns populated from equipment inventory
- Production tab submits correct printer_id/laminator_id/plotter_id
