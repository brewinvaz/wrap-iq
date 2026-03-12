# Multi-Tab Create Work Order Wizard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic single-step Create Work Order modal with a 6-tab wizard (Basic Details, Job & Pricing, Wrap Details, Design, Production, Install Details) matching Dan's product designs.

**Architecture:** Backend-first approach — add Pydantic schemas and API endpoints for work order sub-details (wrap, design, production, install), add `paint_color` to Vehicle model, then build the frontend multi-tab wizard. The frontend wizard collects all data across tabs and submits in a single API call that creates the work order + all sub-details atomically.

**Tech Stack:** FastAPI, SQLAlchemy (async), Pydantic v2, Alembic, Next.js 15, React 19, Tailwind CSS 4, TypeScript

---

## File Structure

### Backend — New Files
- `backend/app/schemas/wrap_details.py` — Pydantic schemas for wrap detail create/response
- `backend/app/schemas/design_details.py` — Pydantic schemas for design detail create/response
- `backend/app/schemas/production_details.py` — Pydantic schemas for production detail create/response
- `backend/app/schemas/install_details.py` — Pydantic schemas for install detail create/response
- `backend/tests/test_routers/test_work_order_details.py` — Tests for the expanded create endpoint

### Backend — Modified Files
- `backend/app/models/vehicle.py` — Add `paint_color` field
- `backend/app/schemas/vehicles.py` — Add `paint_color` to create/update/response
- `backend/app/schemas/work_orders.py` — Expand `WorkOrderCreate` to accept nested sub-details; expand `WorkOrderResponse` to include sub-details
- `backend/app/services/work_orders.py` — Create sub-detail records during work order creation
- `backend/app/routers/work_orders.py` — Update `_to_response()` to serialize sub-details
- `backend/alembic/versions/XXX_add_paint_color_to_vehicles.py` — Migration for paint_color

### Frontend — New Files
- `frontend/src/components/work-orders/wizard/BasicDetailsTab.tsx` — Vehicle type, VIN, year/make/model/color, unit number, wrap coverage, photos
- `frontend/src/components/work-orders/wizard/JobPricingTab.tsx` — Job type, priority, value, dates, client, notes (extracted from current modal)
- `frontend/src/components/work-orders/wizard/WrapDetailsTab.tsx` — Roof, door, window, bumper coverage, misc items, special instructions
- `frontend/src/components/work-orders/wizard/DesignTab.tsx` — Design team assignment, version management
- `frontend/src/components/work-orders/wizard/ProductionTab.tsx` — Equipment, media, laminate, perf selection
- `frontend/src/components/work-orders/wizard/InstallDetailsTab.tsx` — Location, difficulty, dates
- `frontend/src/components/work-orders/wizard/types.ts` — Shared wizard form state types

### Frontend — Modified Files
- `frontend/src/components/work-orders/CreateWorkOrderModal.tsx` — Replace single-step form with tabbed wizard
- `frontend/src/lib/types.ts` — Add/update TypeScript interfaces for API payloads

---

## Chunk 1: Backend Schemas & API

### Task 1: Add paint_color to Vehicle model

**Files:**
- Modify: `backend/app/models/vehicle.py:39` (after `model` field)
- Modify: `backend/app/schemas/vehicles.py` (add to all schemas)

- [ ] **Step 1: Add paint_color to Vehicle model**

In `backend/app/models/vehicle.py`, add after line 39 (`model` field):

```python
paint_color: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

- [ ] **Step 2: Add paint_color to vehicle schemas**

In `backend/app/schemas/vehicles.py`, add `paint_color: str | None = None` to `VehicleCreate`, `VehicleUpdate`, and `VehicleResponse`.

- [ ] **Step 3: Create Alembic migration**

```bash
cd backend && docker compose exec backend alembic revision --autogenerate -m "add paint_color to vehicles"
```

Verify the migration adds a single column. Run:

```bash
make migrate
```

- [ ] **Step 4: Run existing vehicle tests**

```bash
make test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/vehicle.py backend/app/schemas/vehicles.py backend/alembic/versions/
git commit -m "feat: add paint_color field to Vehicle model"
```

---

### Task 2: Create sub-detail Pydantic schemas

**Files:**
- Create: `backend/app/schemas/wrap_details.py`
- Create: `backend/app/schemas/design_details.py`
- Create: `backend/app/schemas/production_details.py`
- Create: `backend/app/schemas/install_details.py`

- [ ] **Step 1: Create wrap_details schema**

Create `backend/app/schemas/wrap_details.py`:

```python
from pydantic import BaseModel

from app.models.wrap_details import (
    BumperCoverage,
    CoverageLevel,
    WindowCoverage,
    WrapCoverage,
)


class WrapDetailsCreate(BaseModel):
    wrap_coverage: WrapCoverage | None = None
    roof_coverage: CoverageLevel | None = None
    door_handles: CoverageLevel | None = None
    window_coverage: WindowCoverage | None = None
    bumper_coverage: BumperCoverage | None = None
    misc_items: list[str] | None = None
    special_wrap_instructions: str | None = None


class WrapDetailsResponse(WrapDetailsCreate):
    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Create design_details schema**

Create `backend/app/schemas/design_details.py`:

```python
from pydantic import BaseModel


class DesignDetailsCreate(BaseModel):
    proofing_data: dict | None = None
    # Note: designer assignment is not yet supported — will be added
    # when a designer-assignment model/endpoint is built (separate issue)


class DesignDetailsResponse(BaseModel):
    design_hours: float | None = None
    design_version_count: int = 0
    revision_count: int = 0
    proofing_data: dict | None = None

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Create production_details schema**

Create `backend/app/schemas/production_details.py`:

```python
from pydantic import BaseModel


class ProductionDetailsCreate(BaseModel):
    assigned_equipment: str | None = None
    print_media_brand_type: str | None = None
    laminate_brand_type: str | None = None
    window_perf_details: dict | None = None


class ProductionDetailsResponse(BaseModel):
    assigned_equipment: str | None = None
    print_media_brand_type: str | None = None
    print_media_width: str | None = None
    laminate_brand_type: str | None = None
    laminate_width: str | None = None
    window_perf_details: dict | None = None

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Create install_details schema**

Create `backend/app/schemas/install_details.py`:

```python
from datetime import datetime

from pydantic import BaseModel

from app.models.install_details import InstallDifficulty, InstallLocation


class InstallDetailsCreate(BaseModel):
    install_location: InstallLocation | None = None
    install_difficulty: InstallDifficulty | None = None
    install_start_date: datetime | None = None
    install_end_date: datetime | None = None


class InstallDetailsResponse(InstallDetailsCreate):
    model_config = {"from_attributes": True}
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/wrap_details.py backend/app/schemas/design_details.py backend/app/schemas/production_details.py backend/app/schemas/install_details.py
git commit -m "feat: add Pydantic schemas for work order sub-details"
```

---

### Task 3: Expand WorkOrderCreate schema to accept nested sub-details

**Files:**
- Modify: `backend/app/schemas/work_orders.py`

- [ ] **Step 1: Add nested sub-detail fields to WorkOrderCreate**

In `backend/app/schemas/work_orders.py`, add imports at the top:

```python
from app.schemas.wrap_details import WrapDetailsCreate, WrapDetailsResponse
from app.schemas.design_details import DesignDetailsCreate, DesignDetailsResponse
from app.schemas.production_details import ProductionDetailsCreate, ProductionDetailsResponse
from app.schemas.install_details import InstallDetailsCreate, InstallDetailsResponse
```

Add to `WorkOrderCreate` class (after `client_id`):

```python
wrap_details: WrapDetailsCreate | None = None
design_details: DesignDetailsCreate | None = None
production_details: ProductionDetailsCreate | None = None
install_details: InstallDetailsCreate | None = None
```

Add to `WorkOrderResponse` class (after `client_name`):

```python
wrap_details: WrapDetailsResponse | None = None
design_details: DesignDetailsResponse | None = None
production_details: ProductionDetailsResponse | None = None
install_details: InstallDetailsResponse | None = None
```

- [ ] **Step 2: Run tests to verify schema changes are backward-compatible**

```bash
make test
```

Expected: all existing tests still pass (new fields are optional).

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/work_orders.py
git commit -m "feat: add nested sub-detail schemas to WorkOrderCreate and WorkOrderResponse"
```

---

### Task 4: Update work order service to create sub-details

**Files:**
- Modify: `backend/app/services/work_orders.py`

- [ ] **Step 1: Update create_work_order to handle sub-details**

In `backend/app/services/work_orders.py`, add imports:

```python
from app.models.design_details import DesignDetails
from app.models.install_details import InstallDetails
from app.models.production_details import ProductionDetails
from app.models.wrap_details import WrapDetails
```

Update `create_work_order` function signature to accept a `sub_details` dict, and create sub-detail records:

```python
async def create_work_order(
    session: AsyncSession,
    org_id: uuid.UUID,
    status_id: uuid.UUID,
    data: dict,
    vehicle_ids: list[uuid.UUID] | None = None,
    sub_details: dict | None = None,
) -> WorkOrder:
    wrap_data = (sub_details or {}).get("wrap_details")
    design_data = (sub_details or {}).get("design_details")
    production_data = (sub_details or {}).get("production_details")
    install_data = (sub_details or {}).get("install_details")

    job_number = await generate_job_number(session, org_id)
    wo = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org_id,
        job_number=job_number,
        status_id=status_id,
        **data,
    )
    session.add(wo)
    await session.flush()

    if vehicle_ids:
        for vid in vehicle_ids:
            session.add(
                WorkOrderVehicle(
                    work_order_id=wo.id, vehicle_id=vid, organization_id=org_id
                )
            )
        await session.flush()

    # Create sub-details if provided
    if wrap_data and vehicle_ids:
        # WrapDetails requires a vehicle_id FK — only create when vehicles exist
        for vid in vehicle_ids:
            session.add(
                WrapDetails(
                    id=uuid.uuid4(),
                    work_order_id=wo.id,
                    vehicle_id=vid,
                    organization_id=org_id,
                    **wrap_data,
                )
            )

    if design_data:
        session.add(
            DesignDetails(
                id=uuid.uuid4(),
                work_order_id=wo.id,
                organization_id=org_id,
                **design_data,
            )
        )

    if production_data:
        session.add(
            ProductionDetails(
                id=uuid.uuid4(),
                work_order_id=wo.id,
                organization_id=org_id,
                **production_data,
            )
        )

    if install_data:
        session.add(
            InstallDetails(
                id=uuid.uuid4(),
                work_order_id=wo.id,
                organization_id=org_id,
                **install_data,
            )
        )

    await session.commit()

    result = await session.execute(
        select(WorkOrder)
        .options(
            selectinload(WorkOrder.work_order_vehicles),
            selectinload(WorkOrder.wrap_details),
            selectinload(WorkOrder.design_details),
            selectinload(WorkOrder.production_details),
            selectinload(WorkOrder.install_details),
        )
        .where(WorkOrder.id == wo.id)
    )
    return result.scalar_one()
```

Also update `get_work_order` and `list_work_orders` to selectinload sub-details:

In `get_work_order`, add to `.options()`:

```python
selectinload(WorkOrder.wrap_details),
selectinload(WorkOrder.design_details),
selectinload(WorkOrder.production_details),
selectinload(WorkOrder.install_details),
```

In `list_work_orders`, add the same selectinloads to the query `.options()`.

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/work_orders.py
git commit -m "feat: create sub-detail records during work order creation"
```

---

### Task 5: Update router _to_response to include sub-details

**Files:**
- Modify: `backend/app/routers/work_orders.py`

- [ ] **Step 1: Update _to_response to serialize sub-details**

In `backend/app/routers/work_orders.py`, update `_to_response`:

```python
def _to_response(wo) -> WorkOrderResponse:
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

    # Get first wrap_details if any exist
    wrap = wo.wrap_details[0] if wo.wrap_details else None

    return WorkOrderResponse(
        id=wo.id,
        job_number=wo.job_number,
        job_type=wo.job_type,
        job_value=wo.job_value,
        priority=wo.priority,
        date_in=wo.date_in,
        estimated_completion_date=wo.estimated_completion_date,
        completion_date=wo.completion_date,
        internal_notes=wo.internal_notes,
        checklist=wo.checklist,
        status=wo.status,
        vehicles=vehicles,
        client_id=wo.client_id,
        client_name=wo.client.name if wo.client else None,
        wrap_details=wrap,
        design_details=wo.design_details,
        production_details=wo.production_details,
        install_details=wo.install_details,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
    )
```

Also update the `create` endpoint to exclude sub-detail fields from the dict passed to `create_work_order`:

In the `create` endpoint, change:

```python
wo_data = data.model_dump(exclude={"vehicle_ids"})
```

to:

```python
wo_data = data.model_dump(
    exclude={"vehicle_ids", "wrap_details", "design_details", "production_details", "install_details"}
)
# Pass sub-detail dicts separately
sub_details = {
    "wrap_details": data.wrap_details.model_dump() if data.wrap_details else None,
    "design_details": data.design_details.model_dump() if data.design_details else None,
    "production_details": data.production_details.model_dump() if data.production_details else None,
    "install_details": data.install_details.model_dump() if data.install_details else None,
}
```

Then pass `sub_details` to `create_work_order` as a new parameter (update both the router call and the service signature to accept `sub_details: dict | None = None` instead of popping from `data`).

- [ ] **Step 2: Run tests**

```bash
make test
```

Expected: all existing tests still pass. The new response fields will be `None` for existing tests since no sub-details are created.

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/work_orders.py
git commit -m "feat: include sub-details in work order API response"
```

---

### Task 6: Write tests for expanded work order creation

**Files:**
- Create: `backend/tests/test_routers/test_work_order_details.py`

- [ ] **Step 1: Write test for creating work order with wrap details**

Create `backend/tests/test_routers/test_work_order_details.py`:

```python
async def _register_and_seed(client, db_session):
    """Register a user and seed kanban stages."""
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "TestPass123",
            "org_name": "My Shop",
        },
    )
    token = resp.json()["access_token"]
    await client.get(
        "/api/kanban-stages",
        headers={"Authorization": f"Bearer {token}"},
    )
    return token


async def test_create_work_order_with_wrap_details(client, db_session):
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "wrap_details": {
                "wrap_coverage": "full",
                "roof_coverage": "full",
                "door_handles": "partial",
                "window_coverage": "perforated_vinyl",
                "bumper_coverage": "both",
                "misc_items": ["mirror_caps", "grill"],
                "special_wrap_instructions": "Careful around mirrors",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["wrap_details"] is not None
    assert data["wrap_details"]["wrap_coverage"] == "full"
    assert data["wrap_details"]["roof_coverage"] == "full"
    assert data["wrap_details"]["bumper_coverage"] == "both"
    assert "mirror_caps" in data["wrap_details"]["misc_items"]


async def test_create_work_order_with_production_details(client, db_session):
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "production_details": {
                "print_media_brand_type": "3M IJ180mc",
                "laminate_brand_type": "3M 8518 Gloss",
                "window_perf_details": {"type": "3M IJ8171"},
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["production_details"] is not None
    assert data["production_details"]["print_media_brand_type"] == "3M IJ180mc"
    assert data["production_details"]["laminate_brand_type"] == "3M 8518 Gloss"


async def test_create_work_order_with_install_details(client, db_session):
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={
            "date_in": "2026-03-10T10:00:00Z",
            "install_details": {
                "install_location": "in_shop",
                "install_difficulty": "standard",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["install_details"] is not None
    assert data["install_details"]["install_location"] == "in_shop"
    assert data["install_details"]["install_difficulty"] == "standard"


async def test_create_work_order_with_all_details(client, db_session):
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={
            "job_type": "commercial",
            "job_value": 7500,
            "priority": "high",
            "date_in": "2026-03-10T10:00:00Z",
            "wrap_details": {
                "wrap_coverage": "three_quarter",
                "roof_coverage": "no",
            },
            "design_details": {
                "proofing_data": {"versions": [{"name": "v1", "status": "draft"}]},
            },
            "production_details": {
                "print_media_brand_type": "Avery MPI 1105",
            },
            "install_details": {
                "install_location": "on_site",
                "install_difficulty": "complex",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["job_value"] == 7500
    assert data["wrap_details"]["wrap_coverage"] == "three_quarter"
    assert data["design_details"] is not None
    assert data["production_details"]["print_media_brand_type"] == "Avery MPI 1105"
    assert data["install_details"]["install_location"] == "on_site"


async def test_create_work_order_without_details_still_works(client, db_session):
    """Backward compatibility: creating without sub-details still works."""
    token = await _register_and_seed(client, db_session)

    resp = await client.post(
        "/api/work-orders",
        json={"date_in": "2026-03-10T10:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["wrap_details"] is None
    assert data["design_details"] is None
    assert data["production_details"] is None
    assert data["install_details"] is None
```

- [ ] **Step 2: Run new tests**

```bash
make test
```

Expected: all tests pass including new detail tests.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_routers/test_work_order_details.py
git commit -m "test: add tests for work order creation with sub-details"
```

---

## Chunk 2: Frontend Wizard — Types & Tab Components

### Task 7: Define wizard form state types

**Files:**
- Create: `frontend/src/components/work-orders/wizard/types.ts`

- [ ] **Step 1: Create wizard types file**

Create `frontend/src/components/work-orders/wizard/types.ts`:

```typescript
export type VehicleType =
  | 'car'
  | 'suv'
  | 'pickup'
  | 'van'
  | 'utility_van'
  | 'box_truck'
  | 'semi'
  | 'trailer';

export type WrapCoverage = 'full' | 'three_quarter' | 'half' | 'spot_graphics';
export type CoverageLevel = 'no' | 'partial' | 'full';
export type WindowCoverage = 'no' | 'solid_vinyl' | 'perforated_vinyl';
export type BumperCoverage = 'no' | 'front' | 'back' | 'both';
export type InstallLocation = 'in_shop' | 'on_site';
export type InstallDifficulty = 'easy' | 'standard' | 'complex';

export interface BasicDetailsState {
  vehicleType: VehicleType | '';
  vin: string;
  year: string;
  make: string;
  model: string;
  paintColor: string;
  unitNumber: string;
  wrapCoverage: WrapCoverage | '';
}

export interface JobPricingState {
  jobType: 'personal' | 'commercial';
  jobValue: number | '';
  priority: 'low' | 'medium' | 'high';
  dateIn: string;
  estimatedCompletionDate: string;
  clientId: string;
  internalNotes: string;
}

export interface WrapDetailsState {
  roofCoverage: CoverageLevel;
  doorHandles: CoverageLevel;
  windowCoverage: WindowCoverage;
  bumperCoverage: BumperCoverage;
  miscItems: string[];
  specialInstructions: string;
}

export interface DesignState {
  designerIds: string[];
  proofingData: {
    versions: { name: string; status: string; files?: string[] }[];
  };
}

export interface ProductionState {
  printer: string;
  laminator: string;
  plotterCutter: string;
  printMedia: string;
  laminate: string;
  windowPerf: string;
  productionNotes: string;
}

export interface InstallState {
  installLocation: InstallLocation | '';
  installDifficulty: InstallDifficulty | '';
  installStartDate: string;
  installEndDate: string;
}

export interface WizardFormState {
  basicDetails: BasicDetailsState;
  jobPricing: JobPricingState;
  wrapDetails: WrapDetailsState;
  design: DesignState;
  production: ProductionState;
  install: InstallState;
}

export const INITIAL_BASIC_DETAILS: BasicDetailsState = {
  vehicleType: '',
  vin: '',
  year: '',
  make: '',
  model: '',
  paintColor: '',
  unitNumber: '',
  wrapCoverage: '',
};

export const INITIAL_JOB_PRICING: JobPricingState = {
  jobType: 'personal',
  jobValue: '',
  priority: 'medium',
  dateIn: new Date().toISOString().split('T')[0],
  estimatedCompletionDate: '',
  clientId: '',
  internalNotes: '',
};

export const INITIAL_WRAP_DETAILS: WrapDetailsState = {
  roofCoverage: 'no',
  doorHandles: 'no',
  windowCoverage: 'no',
  bumperCoverage: 'no',
  miscItems: [],
  specialInstructions: '',
};

export const INITIAL_DESIGN: DesignState = {
  designerIds: [],
  proofingData: { versions: [{ name: 'v1', status: 'draft' }] },
};

export const INITIAL_PRODUCTION: ProductionState = {
  printer: '',
  laminator: '',
  plotterCutter: '',
  printMedia: '',
  laminate: '',
  windowPerf: '',
  productionNotes: '',
};

export const INITIAL_INSTALL: InstallState = {
  installLocation: '',
  installDifficulty: '',
  installStartDate: '',
  installEndDate: '',
};

// Options for production dropdowns (matching Dan's designs)
export const PRINT_MEDIA_OPTIONS = [
  '', '3M IJ180mc', 'Avery MPI 1105', 'Oracal 970RA',
  '3M IJ3552C', 'Avery MPI 2105', 'Custom/Other',
];

export const LAMINATE_OPTIONS = [
  '', '3M 8518 Gloss', '3M 8520 Matte', 'Avery DOL 1360',
  'Oracal 290', 'Custom/Other',
];

export const WINDOW_PERF_OPTIONS = [
  '', '3M IJ8171', 'Avery MPI 3529', 'Oracal 3635', 'Custom/Other',
];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: 'Sedan',
  suv: 'SUV',
  pickup: 'Pickup',
  van: 'Van',
  utility_van: 'Cargo Van',
  box_truck: 'Box Truck',
  semi: 'Semi',
  trailer: 'Trailer',
};

export const WRAP_COVERAGE_LABELS: Record<WrapCoverage, { label: string; pct: string }> = {
  full: { label: 'Full Wrap', pct: '100%' },
  three_quarter: { label: '3/4 Wrap', pct: '75%' },
  half: { label: '1/2 Wrap', pct: '50%' },
  spot_graphics: { label: 'Spot Graphics', pct: '25%' },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/types.ts
git commit -m "feat: add wizard form state types and constants"
```

---

### Task 8: Build BasicDetailsTab component

**Files:**
- Create: `frontend/src/components/work-orders/wizard/BasicDetailsTab.tsx`

- [ ] **Step 1: Create BasicDetailsTab**

Create `frontend/src/components/work-orders/wizard/BasicDetailsTab.tsx`:

This component renders:
- 8-button vehicle type grid (2 rows x 4 columns) with icons
- VIN input with "Decode" button that calls `GET /api/vin/{vin}`
- Year, Make, Model, Paint Color in 2x2 grid
- Unit Number (Fleet) — optional
- Wrap Coverage picker — 4 colored toggle buttons (Full=green, 3/4=blue, 1/2=orange, Spot=purple)
- Vehicle Photos section — 4 upload zones (Driver Side, Passenger Side, Front, Back)

**Props:** `{ data: BasicDetailsState; onChange: (data: BasicDetailsState) => void }`

Key behaviors:
- VIN Decode button calls `api.get<VehicleInfo>(\`/api/vin/${vin}\`)` and auto-fills year, make, model, vehicleType
- Vehicle type buttons are toggle-selectable (only one active)
- Wrap coverage buttons are toggle-selectable with color coding
- Photo upload zones are visual placeholders (upload functionality deferred to separate issue)

The component should follow the existing Tailwind patterns from the codebase:
- Input class: `w-full rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]`
- Label class: `mb-1.5 block text-sm font-medium text-[var(--text-primary)]`

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/BasicDetailsTab.tsx
git commit -m "feat: add BasicDetailsTab component with vehicle type, VIN decode, and wrap coverage"
```

---

### Task 9: Build JobPricingTab component

**Files:**
- Create: `frontend/src/components/work-orders/wizard/JobPricingTab.tsx`

- [ ] **Step 1: Create JobPricingTab**

Extract the existing form fields from `CreateWorkOrderModal.tsx` into a new tab component. This tab contains:
- Job Type toggle (Personal / Commercial)
- Priority toggle (Low / Medium / High)
- Job Value ($) input
- Date In and Est. Completion date inputs
- Client dropdown (loads from `/api/clients?limit=500`)
- Internal Notes textarea

**Props:** `{ data: JobPricingState; onChange: (data: JobPricingState) => void }`

Follow the exact same field layout and styling from the current `CreateWorkOrderModal.tsx`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/JobPricingTab.tsx
git commit -m "feat: add JobPricingTab component extracted from current modal"
```

---

### Task 10: Build WrapDetailsTab component

**Files:**
- Create: `frontend/src/components/work-orders/wizard/WrapDetailsTab.tsx`

- [ ] **Step 1: Create WrapDetailsTab**

This component renders (matching Dan's design exactly):
- Info banner at top: "Vehicle Details Not Set / Wrap coverage not selected" (when Basic Details incomplete)
- **Roof Coverage**: 3 toggle buttons — No Roof / Partial Roof / Full Roof
- **Door Handles**: 3 toggle buttons — No Handles / Partial Handle / Full Handle
- **Window Coverage**: 3 toggle buttons — No Windows / Solid Vinyl / Perforated
- **Bumpers**: 4 toggle buttons — No Bumpers / Front Only / Back Only / Front & Back
- **Additional Elements**: 4 checkboxes — Mirror Caps, Grill, Plastic Trim, 100% Paint Coverage
- **Special Instructions**: textarea
- **Wrap Coverage Summary**: read-only display showing Roof, Door Handles, Windows, Extras status

**Props:** `{ data: WrapDetailsState; onChange: (data: WrapDetailsState) => void; wrapCoverage: string }`

Each section uses a radio-group pattern with toggle buttons (same as roof/door/window/bumper in the designs).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/WrapDetailsTab.tsx
git commit -m "feat: add WrapDetailsTab component with coverage toggles and summary"
```

---

### Task 11: Build DesignTab component

**Files:**
- Create: `frontend/src/components/work-orders/wizard/DesignTab.tsx`

- [ ] **Step 1: Create DesignTab**

This component renders (matching Dan's design):
- **Design Team** section: Search input for designers (0/3 assigned), user avatar icon
- **Design Management** section: Version cards (v1 with "draft" badge, upload area, "Upload" and "URL" links), and a dashed "+ Add Version v2" card

**Props:** `{ data: DesignState; onChange: (data: DesignState) => void }`

Designer search is a text input that will filter team members (for now, static — designer list API can be added later). Version management shows card grid with upload placeholder areas.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/DesignTab.tsx
git commit -m "feat: add DesignTab component with team assignment and version management"
```

---

### Task 12: Build ProductionTab component

**Files:**
- Create: `frontend/src/components/work-orders/wizard/ProductionTab.tsx`

- [ ] **Step 1: Create ProductionTab**

This component renders (matching Dan's design exactly):
- **Printer**: radio group — "No Printer" (default selected), expandable to select from equipment list
- **Laminator**: radio group — "No Laminator" (default)
- **Plotter/Cutter**: radio group — "No Plotter" (default)
- **Print Media**: button grid of brand/type options — No Print Media, 3M IJ180mc, Avery MPI 1105, Oracal 970RA, 3M IJ3552C, Avery MPI 2105, Custom/Other
- **Laminate**: button grid — No Laminate, 3M 8518 Gloss, 3M 8520 Matte, Avery DOL 1360, Oracal 290, Custom/Other
- **Window Perforation**: button grid — No Window Perf, 3M IJ8171, Avery MPI 3529, Oracal 3635, Custom/Other
- **Production Notes**: textarea

**Props:** `{ data: ProductionState; onChange: (data: ProductionState) => void }`

Each section has a radio-circle icon on the left (matching the design's circle markers). Button grids use 3-column layout.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/ProductionTab.tsx
git commit -m "feat: add ProductionTab component with media and equipment selection"
```

---

### Task 13: Build InstallDetailsTab component

**Files:**
- Create: `frontend/src/components/work-orders/wizard/InstallDetailsTab.tsx`

- [ ] **Step 1: Create InstallDetailsTab**

This component renders:
- **Install Location**: toggle buttons — In Shop / On Site
- **Install Difficulty**: toggle buttons — Easy / Standard / Complex
- **Install Start Date**: date input
- **Install End Date**: date input

**Props:** `{ data: InstallState; onChange: (data: InstallState) => void }`

Simple form matching existing toggle-button and date-input patterns.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/InstallDetailsTab.tsx
git commit -m "feat: add InstallDetailsTab component"
```

---

## Chunk 3: Frontend Wizard — Main Modal Rewrite

### Task 14: Rewrite CreateWorkOrderModal as tabbed wizard

**Files:**
- Modify: `frontend/src/components/work-orders/CreateWorkOrderModal.tsx`

- [ ] **Step 1: Rewrite the modal with tab navigation**

Replace the current single-step form with a tabbed wizard. The modal structure:

```
┌─ Create Work Order ──────────────────────── X ─┐
│                                                  │
│  [Basic Details] [Job & Pricing] [Wrap Details]  │
│  [Design] [Production] [Install Details]         │
│  ────────────────────────────────────────────    │
│                                                  │
│  <Active tab content here>                       │
│                                                  │
│                     [Cancel] [Create Work Order]  │
└──────────────────────────────────────────────────┘
```

Key implementation details:
- `activeTab` state (0-5) controlling which tab content renders
- Tab bar with 6 tabs, each with icon + label (matching design: clipboard, dollar, wrap, palette, factory, calendar icons)
- Active tab has colored underline (blue)
- Form state uses the types from `wizard/types.ts`
- Each tab component receives its slice of state + onChange callback
- "Create Work Order" button submits all data via single `POST /api/work-orders`
- Cancel button resets form and closes modal
- Modal should scroll vertically for long tab content

Submit handler builds the API payload:
```typescript
const payload = {
  job_type: state.jobPricing.jobType,
  job_value: Math.round((state.jobPricing.jobValue || 0) * 100),
  priority: state.jobPricing.priority,
  date_in: state.jobPricing.dateIn,
  estimated_completion_date: state.jobPricing.estimatedCompletionDate || null,
  internal_notes: state.jobPricing.internalNotes || null,
  client_id: state.jobPricing.clientId || null,
  vehicle_ids: vehicleId ? [vehicleId] : [],
  wrap_details: state.basicDetails.wrapCoverage ? {
    wrap_coverage: state.basicDetails.wrapCoverage,
    roof_coverage: state.wrapDetails.roofCoverage,
    door_handles: state.wrapDetails.doorHandles,
    window_coverage: state.wrapDetails.windowCoverage,
    bumper_coverage: state.wrapDetails.bumperCoverage,
    misc_items: state.wrapDetails.miscItems,
    special_wrap_instructions: state.wrapDetails.specialInstructions || null,
  } : null,
  design_details: state.design.proofingData ? {
    proofing_data: state.design.proofingData,
  } : null,
  production_details: (state.production.printMedia || state.production.laminate || state.production.printer) ? {
    assigned_equipment: JSON.stringify({
      printer: state.production.printer || null,
      laminator: state.production.laminator || null,
      plotter_cutter: state.production.plotterCutter || null,
    }),
    print_media_brand_type: state.production.printMedia || null,
    laminate_brand_type: state.production.laminate || null,
    window_perf_details: state.production.windowPerf ? { type: state.production.windowPerf } : null,
  } : null,
  install_details: state.install.installLocation ? {
    install_location: state.install.installLocation,
    install_difficulty: state.install.installDifficulty || null,
    install_start_date: state.install.installStartDate || null,
    install_end_date: state.install.installEndDate || null,
  } : null,
};
```

Vehicle creation flow: when Basic Details has vehicle info (VIN or year/make/model), first call `POST /api/vehicles` to create the vehicle, then include the vehicle ID in `vehicle_ids`.

- [ ] **Step 2: Verify the modal opens correctly from work orders page**

Open the app, navigate to Work Orders, click "+ New Work Order". Verify:
- Modal opens with 6 tabs
- Tab switching works
- Form fields render correctly
- Can fill and submit a basic work order (Job & Pricing tab only)
- Can fill all tabs and submit with full details

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/work-orders/CreateWorkOrderModal.tsx
git commit -m "feat: rewrite CreateWorkOrderModal as 6-tab wizard"
```

---

### Task 15: Run full test suite and fix any issues

- [ ] **Step 1: Run backend tests**

```bash
make test
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

```bash
cd frontend && npm run build
```

Expected: no TypeScript or build errors.

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve any build/test issues from wizard implementation"
```

---

## Known Limitations (to address in future issues)

1. **No WorkOrderUpdate for sub-details** — PATCH endpoint only updates basic fields. Editing sub-details after creation requires new endpoints.
2. **Designer assignment is UI-only** — the Design tab shows a search input but there's no backend model for work-order-to-designer assignment. Selecting designers is cosmetic until a designer assignment model is built.
3. **Vehicle photos in wizard are placeholder** — the upload zones render but actual upload integration (presigned URLs to R2) is deferred. The existing `PhotoUploadZone` component handles post-creation photo uploads.
4. **WrapDetails requires a vehicle** — if no vehicle is attached to the work order, wrap details are not persisted (the `vehicle_id` FK is non-nullable). The wizard should guide users to add vehicle info first.
5. **Equipment selection is free-text** — Printer/Laminator/Plotter fields store as a JSON string in `assigned_equipment`. Once Equipment Management (issue #476) is built, these should link to equipment records.
6. **`quarter` wrap coverage** — the backend enum supports it but the wizard UI only shows 4 options matching Dan's designs (Full, 3/4, 1/2, Spot Graphics).
