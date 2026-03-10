# Work Order & Project Data Models Design

## Overview

Core data models for WrapFlow.io project management: work orders, vehicles, wrap specifications, design/production/install tracking, and customizable Kanban stages.

**Related issues:** #11 (Work order and vehicle data models), #12 (Wrap, design, production, and install data models), #25 (Customizable Kanban stages)

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vehicle relationship | Separate table + junction | Enables fleet tracking, VIN reuse across jobs, batch upload |
| Phase details | Separate tables per concern | Role isolation, clean schema, easy to extend |
| Kanban stages | DB-driven (KanbanStage table) | Customizable per org, WorkOrder.status FKs to it |
| Time logs | Separate table | Multiple installers log separate prep/install/demo hours |
| Wrap details | Per vehicle in work order | Different vehicles in a fleet may have different wrap specs |

## Data Models

### KanbanStage
```
KanbanStage (TenantMixin, TimestampMixin)
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── name: str (e.g., "Work Order", "Design", "Production", "Install", "Completed")
├── position: int (ordering)
├── color: str (hex color for UI)
└── is_terminal: bool (marks job as complete)
```

Default stages seeded per org on creation.

### WorkOrder
```
WorkOrder (TenantMixin, TimestampMixin)
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── job_number: str (auto-generated, e.g., "WO-2001")
├── job_type: enum (Commercial, Personal)
├── job_value: int (cents)
├── status_id: UUID (FK → KanbanStage)
├── priority: enum (High, Medium, Low)
├── date_in: datetime
├── estimated_completion_date: datetime (nullable)
├── completion_date: datetime (nullable)
├── internal_notes: text (nullable)
├── before_photos: JSONB (array of URLs)
├── after_photos: JSONB (array of URLs)
├── status_timestamps: JSONB (dict of stage_id → timestamp)
│
├── status → KanbanStage
├── vehicles → Vehicle (via WorkOrderVehicle)
├── wrap_details → WrapDetails[]
├── design_details → DesignDetails (1:1)
├── production_details → ProductionDetails (1:1)
└── install_details → InstallDetails (1:1)
```

### Vehicle
```
Vehicle (TenantMixin, TimestampMixin)
├── id: UUID (PK)
├── organization_id: UUID (FK)
├── vin: str (nullable, indexed)
├── year: int (nullable)
├── make: str (nullable)
├── model: str (nullable)
├── vehicle_unit_number: str (nullable, for fleet tracking)
├── vehicle_type: enum (Car, SUV, Pickup, Van, UtilityVan, BoxTruck, Semi, Trailer)
├── truck_cab_size: enum (Regular, Extended, Crew) (nullable)
├── truck_bed_length: str (nullable)
├── van_roof_height: enum (Low, Medium, High) (nullable)
├── van_wheelbase: str (nullable)
└── van_length: enum (Regular, Extended) (nullable)
```

VIN is unique per organization (same VIN can exist in different orgs).

### WorkOrderVehicle
```
WorkOrderVehicle
├── work_order_id: UUID (FK, PK)
├── vehicle_id: UUID (FK, PK)
└── created_at: datetime
```

### WrapDetails
```
WrapDetails (TimestampMixin)
├── id: UUID (PK)
├── work_order_id: UUID (FK)
├── vehicle_id: UUID (FK)
├── wrap_coverage: enum (Full, ThreeQuarter, Half, Quarter, SpotGraphics)
├── roof_coverage: enum (No, Partial, Full)
├── door_handles: enum (No, Partial, Full)
├── window_coverage: enum (No, SolidVinyl, PerforatedVinyl)
├── bumper_coverage: enum (No, Front, Back, Both)
├── misc_items: JSONB (array of strings)
└── special_wrap_instructions: text (nullable)
```

### DesignDetails
```
DesignDetails (TimestampMixin)
├── id: UUID (PK)
├── work_order_id: UUID (FK, unique — 1:1)
├── design_hours: Decimal (nullable)
├── design_version_count: int (default 0)
├── revision_count: int (default 0)
└── proofing_data: JSONB (nullable)
```

### ProductionDetails
```
ProductionDetails (TimestampMixin)
├── id: UUID (PK)
├── work_order_id: UUID (FK, unique — 1:1)
├── assigned_equipment: str (nullable)
├── print_media_brand_type: str (nullable)
├── print_media_width: str (nullable)
├── laminate_brand_type: str (nullable)
├── laminate_width: str (nullable)
├── window_perf_details: JSONB (nullable)
├── media_print_length: Decimal (nullable)
├── media_ink_fill_percentage: Decimal (nullable)
└── sq_ft_printed_and_waste: Decimal (nullable)
```

### InstallDetails
```
InstallDetails (TimestampMixin)
├── id: UUID (PK)
├── work_order_id: UUID (FK, unique — 1:1)
├── install_location: enum (InShop, OnSite)
├── install_difficulty: enum (Easy, Standard, Complex)
├── install_start_date: datetime (nullable)
└── install_end_date: datetime (nullable)
```

### InstallTimeLog
```
InstallTimeLog (TimestampMixin)
├── id: UUID (PK)
├── install_details_id: UUID (FK)
├── user_id: UUID (FK → User)
├── log_type: enum (DemoRemoval, Prep, Install)
├── hours: Decimal
└── notes: text (nullable)
```

## API Routes (CRUD)

```
# Work Orders
GET    /api/work-orders              # List (filtered by org, with pagination)
POST   /api/work-orders              # Create
GET    /api/work-orders/{id}         # Get with all details
PATCH  /api/work-orders/{id}         # Update
PATCH  /api/work-orders/{id}/status  # Move to different Kanban stage

# Vehicles
GET    /api/vehicles                 # List (filtered by org)
POST   /api/vehicles                 # Create
GET    /api/vehicles/{id}            # Get
PATCH  /api/vehicles/{id}            # Update

# Kanban Stages
GET    /api/kanban-stages            # List stages for org
POST   /api/kanban-stages            # Create custom stage
PATCH  /api/kanban-stages/{id}       # Update (name, position, color)
DELETE /api/kanban-stages/{id}       # Delete (if no work orders use it)
```
