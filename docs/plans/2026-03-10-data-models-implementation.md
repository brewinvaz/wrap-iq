# Data Models Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement work order, vehicle, wrap/design/production/install data models, Kanban stages, and CRUD API routes.

**Architecture:** Separate tables per concern, junction table for work order ↔ vehicle, DB-driven Kanban stages. All tenant-scoped via TenantMixin.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, pytest

---

### Task 1: Add enum types and KanbanStage model

**Files:**
- Create: `backend/app/models/kanban_stage.py`
- Create: `backend/tests/test_models/test_kanban_stage.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write the failing test**

Create `backend/tests/test_models/test_kanban_stage.py`:

```python
import uuid

from sqlalchemy import select

from app.models.kanban_stage import KanbanStage
from app.models.organization import Organization
from app.models.plan import Plan


async def test_create_kanban_stage(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Design",
        position=1,
        color="#7c3aed",
        is_terminal=False,
    )
    db_session.add(stage)
    await db_session.commit()

    result = await db_session.execute(
        select(KanbanStage).where(KanbanStage.organization_id == org.id)
    )
    saved = result.scalar_one()
    assert saved.name == "Design"
    assert saved.position == 1
    assert saved.is_terminal is False
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/brewinvaz/repos/wrap-iq/backend && uv run pytest tests/test_models/test_kanban_stage.py -v`

Expected: FAIL

**Step 3: Write the KanbanStage model**

Create `backend/app/models/kanban_stage.py`:

```python
import uuid

from sqlalchemy import Boolean, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class KanbanStage(Base, TenantMixin, TimestampMixin):
    __tablename__ = "kanban_stages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(7), default="#2563eb")
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False)
```

**Step 4: Update models __init__.py** to add KanbanStage import and export.

**Step 5: Run test to verify it passes**

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add KanbanStage model"
```

---

### Task 2: Add Vehicle model with enums

**Files:**
- Create: `backend/app/models/vehicle.py`
- Create: `backend/tests/test_models/test_vehicle.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write the failing test**

Create `backend/tests/test_models/test_vehicle.py`:

```python
import uuid

from sqlalchemy import select

from app.models.organization import Organization
from app.models.plan import Plan
from app.models.vehicle import Vehicle, VehicleType


async def test_create_vehicle(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    vehicle = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        vin="1FTFW1E57MFA00001",
        year=2024,
        make="Ford",
        model="F-150",
        vehicle_type=VehicleType.PICKUP,
        truck_cab_size="Crew",
        truck_bed_length="6.5'",
    )
    db_session.add(vehicle)
    await db_session.commit()

    result = await db_session.execute(
        select(Vehicle).where(Vehicle.vin == "1FTFW1E57MFA00001")
    )
    saved = result.scalar_one()
    assert saved.make == "Ford"
    assert saved.vehicle_type == VehicleType.PICKUP
    assert saved.truck_cab_size == "Crew"


async def test_create_utility_van(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop-2", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()

    vehicle = Vehicle(
        id=uuid.uuid4(),
        organization_id=org.id,
        year=2024,
        make="Mercedes",
        model="Sprinter",
        vehicle_type=VehicleType.UTILITY_VAN,
        van_roof_height="High",
        van_wheelbase="170\"",
        van_length="Extended",
    )
    db_session.add(vehicle)
    await db_session.commit()

    result = await db_session.execute(
        select(Vehicle).where(Vehicle.organization_id == org.id)
    )
    saved = result.scalar_one()
    assert saved.van_roof_height == "High"
    assert saved.van_length == "Extended"
```

**Step 2: Run test to verify it fails**

**Step 3: Write the Vehicle model**

Create `backend/app/models/vehicle.py`:

```python
import enum
import uuid

from sqlalchemy import Enum, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class VehicleType(enum.StrEnum):
    CAR = "car"
    SUV = "suv"
    PICKUP = "pickup"
    VAN = "van"
    UTILITY_VAN = "utility_van"
    BOX_TRUCK = "box_truck"
    SEMI = "semi"
    TRAILER = "trailer"


class Vehicle(Base, TenantMixin, TimestampMixin):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    vin: Mapped[str | None] = mapped_column(String(17), nullable=True, index=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    make: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vehicle_unit_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    vehicle_type: Mapped[VehicleType | None] = mapped_column(
        Enum(VehicleType), nullable=True
    )
    # Truck-specific
    truck_cab_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    truck_bed_length: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Van-specific
    van_roof_height: Mapped[str | None] = mapped_column(String(50), nullable=True)
    van_wheelbase: Mapped[str | None] = mapped_column(String(50), nullable=True)
    van_length: Mapped[str | None] = mapped_column(String(50), nullable=True)
```

**Step 4: Update models __init__.py**

**Step 5: Run test, verify pass**

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add Vehicle model with type-specific fields"
```

---

### Task 3: Add WorkOrder model and WorkOrderVehicle junction

**Files:**
- Create: `backend/app/models/work_order.py`
- Create: `backend/tests/test_models/test_work_order.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write the failing test**

Create `backend/tests/test_models/test_work_order.py`:

```python
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.kanban_stage import KanbanStage
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.vehicle import Vehicle, VehicleType
from app.models.work_order import JobType, Priority, WorkOrder, WorkOrderVehicle


async def _setup(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    stage = KanbanStage(
        id=uuid.uuid4(), organization_id=org.id, name="Work Order", position=0
    )
    db_session.add(stage)
    await db_session.flush()
    return org, stage


async def test_create_work_order(db_session):
    org, stage = await _setup(db_session)

    wo = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-2001",
        job_type=JobType.COMMERCIAL,
        job_value=450000,
        status_id=stage.id,
        priority=Priority.HIGH,
        date_in=datetime.now(UTC),
    )
    db_session.add(wo)
    await db_session.commit()

    result = await db_session.execute(
        select(WorkOrder).where(WorkOrder.job_number == "WO-2001")
    )
    saved = result.scalar_one()
    assert saved.job_value == 450000
    assert saved.priority == Priority.HIGH


async def test_work_order_with_multiple_vehicles(db_session):
    org, stage = await _setup(db_session)

    v1 = Vehicle(
        id=uuid.uuid4(), organization_id=org.id, make="Ford", model="F-150",
        vehicle_type=VehicleType.PICKUP,
    )
    v2 = Vehicle(
        id=uuid.uuid4(), organization_id=org.id, make="Ford", model="Transit",
        vehicle_type=VehicleType.VAN,
    )
    db_session.add_all([v1, v2])
    await db_session.flush()

    wo = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-2002",
        job_type=JobType.COMMERCIAL,
        job_value=800000,
        status_id=stage.id,
        date_in=datetime.now(UTC),
    )
    db_session.add(wo)
    await db_session.flush()

    db_session.add_all([
        WorkOrderVehicle(work_order_id=wo.id, vehicle_id=v1.id),
        WorkOrderVehicle(work_order_id=wo.id, vehicle_id=v2.id),
    ])
    await db_session.commit()

    result = await db_session.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.work_order_vehicles))
        .where(WorkOrder.id == wo.id)
    )
    saved = result.scalar_one()
    assert len(saved.work_order_vehicles) == 2
```

**Step 2: Run test to verify it fails**

**Step 3: Write the WorkOrder model**

Create `backend/app/models/work_order.py`:

```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class JobType(enum.StrEnum):
    COMMERCIAL = "commercial"
    PERSONAL = "personal"


class Priority(enum.StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class WorkOrder(Base, TenantMixin, TimestampMixin):
    __tablename__ = "work_orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_number: Mapped[str] = mapped_column(String(50), index=True)
    job_type: Mapped[JobType] = mapped_column(Enum(JobType), default=JobType.PERSONAL)
    job_value: Mapped[int] = mapped_column(Integer, default=0)
    status_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("kanban_stages.id"), index=True
    )
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority), default=Priority.MEDIUM
    )
    date_in: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    estimated_completion_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completion_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    before_photos: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after_photos: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status_timestamps: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    status = relationship("KanbanStage", lazy="selectin")
    work_order_vehicles = relationship(
        "WorkOrderVehicle", back_populates="work_order", lazy="selectin"
    )
    design_details = relationship(
        "DesignDetails", back_populates="work_order", uselist=False, lazy="selectin"
    )
    production_details = relationship(
        "ProductionDetails", back_populates="work_order", uselist=False, lazy="selectin"
    )
    install_details = relationship(
        "InstallDetails", back_populates="work_order", uselist=False, lazy="selectin"
    )


class WorkOrderVehicle(Base):
    __tablename__ = "work_order_vehicles"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), primary_key=True
    )
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("vehicles.id"), primary_key=True
    )

    work_order = relationship("WorkOrder", back_populates="work_order_vehicles")
    vehicle = relationship("Vehicle", lazy="selectin")
```

**Step 4: Update models __init__.py**

**Step 5: Run test, verify pass**

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add WorkOrder and WorkOrderVehicle models"
```

---

### Task 4: Add WrapDetails, DesignDetails, ProductionDetails, InstallDetails, InstallTimeLog models

**Files:**
- Create: `backend/app/models/wrap_details.py`
- Create: `backend/app/models/design_details.py`
- Create: `backend/app/models/production_details.py`
- Create: `backend/app/models/install_details.py`
- Create: `backend/tests/test_models/test_project_details.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write the failing test**

Create `backend/tests/test_models/test_project_details.py`:

```python
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select

from app.models.design_details import DesignDetails
from app.models.install_details import InstallDetails, InstallTimeLog, LogType
from app.models.kanban_stage import KanbanStage
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.production_details import ProductionDetails
from app.models.user import User
from app.models.vehicle import Vehicle, VehicleType
from app.models.work_order import WorkOrder, WorkOrderVehicle
from app.models.wrap_details import WrapCoverage, WrapDetails


async def _setup_wo(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    stage = KanbanStage(
        id=uuid.uuid4(), organization_id=org.id, name="Design", position=1
    )
    db_session.add(stage)
    await db_session.flush()
    vehicle = Vehicle(
        id=uuid.uuid4(), organization_id=org.id, make="Ford", model="F-150",
        vehicle_type=VehicleType.PICKUP,
    )
    db_session.add(vehicle)
    await db_session.flush()
    wo = WorkOrder(
        id=uuid.uuid4(), organization_id=org.id, job_number="WO-3001",
        status_id=stage.id, date_in=datetime.now(UTC), job_value=300000,
    )
    db_session.add(wo)
    await db_session.flush()
    db_session.add(WorkOrderVehicle(work_order_id=wo.id, vehicle_id=vehicle.id))
    await db_session.flush()
    return org, wo, vehicle


async def test_wrap_details(db_session):
    org, wo, vehicle = await _setup_wo(db_session)
    wd = WrapDetails(
        id=uuid.uuid4(), work_order_id=wo.id, vehicle_id=vehicle.id,
        wrap_coverage=WrapCoverage.FULL,
        misc_items=["Mirror Caps", "Grill"],
        special_wrap_instructions="Avoid seams on driver door",
    )
    db_session.add(wd)
    await db_session.commit()

    result = await db_session.execute(
        select(WrapDetails).where(WrapDetails.work_order_id == wo.id)
    )
    saved = result.scalar_one()
    assert saved.wrap_coverage == WrapCoverage.FULL
    assert "Mirror Caps" in saved.misc_items


async def test_design_details(db_session):
    org, wo, vehicle = await _setup_wo(db_session)
    dd = DesignDetails(
        id=uuid.uuid4(), work_order_id=wo.id,
        design_hours=Decimal("4.5"), design_version_count=2, revision_count=3,
    )
    db_session.add(dd)
    await db_session.commit()

    result = await db_session.execute(
        select(DesignDetails).where(DesignDetails.work_order_id == wo.id)
    )
    saved = result.scalar_one()
    assert saved.design_hours == Decimal("4.5")
    assert saved.revision_count == 3


async def test_production_details(db_session):
    org, wo, vehicle = await _setup_wo(db_session)
    pd = ProductionDetails(
        id=uuid.uuid4(), work_order_id=wo.id,
        assigned_equipment="HP Latex 800",
        print_media_brand_type="Avery 1105",
        print_media_width="54\"",
    )
    db_session.add(pd)
    await db_session.commit()

    result = await db_session.execute(
        select(ProductionDetails).where(ProductionDetails.work_order_id == wo.id)
    )
    saved = result.scalar_one()
    assert saved.assigned_equipment == "HP Latex 800"


async def test_install_details_with_time_log(db_session):
    org, wo, vehicle = await _setup_wo(db_session)
    installer = User(
        id=uuid.uuid4(), organization_id=org.id, email="installer@shop.com",
        password_hash="hashed",
    )
    db_session.add(installer)
    await db_session.flush()

    install = InstallDetails(
        id=uuid.uuid4(), work_order_id=wo.id,
        install_location="in_shop", install_difficulty="standard",
    )
    db_session.add(install)
    await db_session.flush()

    log = InstallTimeLog(
        id=uuid.uuid4(), install_details_id=install.id,
        user_id=installer.id, log_type=LogType.INSTALL,
        hours=Decimal("3.5"),
    )
    db_session.add(log)
    await db_session.commit()

    result = await db_session.execute(
        select(InstallTimeLog).where(InstallTimeLog.install_details_id == install.id)
    )
    saved = result.scalar_one()
    assert saved.hours == Decimal("3.5")
    assert saved.log_type == LogType.INSTALL
```

**Step 2: Run test to verify it fails**

**Step 3: Write all four model files**

Create `backend/app/models/wrap_details.py`:

```python
import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TimestampMixin


class WrapCoverage(enum.StrEnum):
    FULL = "full"
    THREE_QUARTER = "three_quarter"
    HALF = "half"
    QUARTER = "quarter"
    SPOT_GRAPHICS = "spot_graphics"


class CoverageLevel(enum.StrEnum):
    NO = "no"
    PARTIAL = "partial"
    FULL = "full"


class WindowCoverage(enum.StrEnum):
    NO = "no"
    SOLID_VINYL = "solid_vinyl"
    PERFORATED_VINYL = "perforated_vinyl"


class BumperCoverage(enum.StrEnum):
    NO = "no"
    FRONT = "front"
    BACK = "back"
    BOTH = "both"


class WrapDetails(Base, TimestampMixin):
    __tablename__ = "wrap_details"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), index=True
    )
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("vehicles.id"), index=True
    )
    wrap_coverage: Mapped[WrapCoverage | None] = mapped_column(
        Enum(WrapCoverage), nullable=True
    )
    roof_coverage: Mapped[CoverageLevel | None] = mapped_column(
        Enum(CoverageLevel, name="roof_coverage_level"), nullable=True
    )
    door_handles: Mapped[CoverageLevel | None] = mapped_column(
        Enum(CoverageLevel, name="door_handle_coverage"), nullable=True
    )
    window_coverage: Mapped[WindowCoverage | None] = mapped_column(
        Enum(WindowCoverage), nullable=True
    )
    bumper_coverage: Mapped[BumperCoverage | None] = mapped_column(
        Enum(BumperCoverage), nullable=True
    )
    misc_items: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    special_wrap_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
```

Create `backend/app/models/design_details.py`:

```python
import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin


class DesignDetails(Base, TimestampMixin):
    __tablename__ = "design_details"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), unique=True, index=True
    )
    design_hours: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    design_version_count: Mapped[int] = mapped_column(Integer, default=0)
    revision_count: Mapped[int] = mapped_column(Integer, default=0)
    proofing_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    work_order = relationship("WorkOrder", back_populates="design_details")
```

Create `backend/app/models/production_details.py`:

```python
import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin


class ProductionDetails(Base, TimestampMixin):
    __tablename__ = "production_details"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), unique=True, index=True
    )
    assigned_equipment: Mapped[str | None] = mapped_column(String(255), nullable=True)
    print_media_brand_type: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    print_media_width: Mapped[str | None] = mapped_column(String(50), nullable=True)
    laminate_brand_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    laminate_width: Mapped[str | None] = mapped_column(String(50), nullable=True)
    window_perf_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    media_print_length: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    media_ink_fill_percentage: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    sq_ft_printed_and_waste: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    work_order = relationship("WorkOrder", back_populates="production_details")
```

Create `backend/app/models/install_details.py`:

```python
import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin


class InstallLocation(enum.StrEnum):
    IN_SHOP = "in_shop"
    ON_SITE = "on_site"


class InstallDifficulty(enum.StrEnum):
    EASY = "easy"
    STANDARD = "standard"
    COMPLEX = "complex"


class LogType(enum.StrEnum):
    DEMO_REMOVAL = "demo_removal"
    PREP = "prep"
    INSTALL = "install"


class InstallDetails(Base, TimestampMixin):
    __tablename__ = "install_details"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), unique=True, index=True
    )
    install_location: Mapped[str | None] = mapped_column(String(50), nullable=True)
    install_difficulty: Mapped[str | None] = mapped_column(String(50), nullable=True)
    install_start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    install_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    work_order = relationship("WorkOrder", back_populates="install_details")
    time_logs = relationship("InstallTimeLog", back_populates="install_details", lazy="selectin")


class InstallTimeLog(Base, TimestampMixin):
    __tablename__ = "install_time_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    install_details_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("install_details.id"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True
    )
    log_type: Mapped[LogType] = mapped_column(Enum(LogType))
    hours: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    install_details = relationship("InstallDetails", back_populates="time_logs")
    user = relationship("User", lazy="selectin")
```

**Step 4: Update models __init__.py** with all new imports.

**Step 5: Run tests**

**Step 6: Commit**

```bash
git add backend/app/models/ backend/tests/
git commit -m "feat: add WrapDetails, DesignDetails, ProductionDetails, InstallDetails models"
```

---

### Task 5: Generate Alembic migration for new tables

**Step 1: Generate migration**

Run: `cd /Users/brewinvaz/repos/wrap-iq/backend && uv run alembic revision --autogenerate -m "add project data models"`

If autogenerate fails (no DB), create manually.

**Step 2: Review and run migration (if DB available)**

**Step 3: Commit**

```bash
git add backend/alembic/
git commit -m "feat: add migration for project data models"
```

---

### Task 6: Add WorkOrder CRUD service and API routes

**Files:**
- Create: `backend/app/services/work_orders.py`
- Create: `backend/app/schemas/work_orders.py`
- Create: `backend/app/routers/work_orders.py`
- Create: `backend/tests/test_routers/test_work_orders.py`
- Modify: `backend/app/main.py`

**Step 1: Create Pydantic schemas for work orders**

Create `backend/app/schemas/work_orders.py` with:
- `WorkOrderCreate` (job_type, job_value, priority, vehicle_ids, date_in)
- `WorkOrderUpdate` (partial update fields)
- `WorkOrderResponse` (all fields + nested vehicle/status info)
- `WorkOrderListResponse` (paginated list)
- `StatusUpdateRequest` (status_id)

**Step 2: Create work order service**

Create `backend/app/services/work_orders.py` with:
- `create_work_order` — creates WO, links vehicles, auto-generates job_number
- `get_work_order` — returns WO with all details
- `list_work_orders` — paginated list filtered by org, optional status filter
- `update_work_order` — partial update
- `update_status` — move to different Kanban stage, record timestamp

**Step 3: Create work order router**

Create `backend/app/routers/work_orders.py` with CRUD endpoints at `/api/work-orders`.

**Step 4: Register router in main.py**

**Step 5: Write API tests**

Test: create work order, list work orders, get by id, update, move status.

**Step 6: Run tests, commit**

```bash
git add backend/app/routers/ backend/app/schemas/ backend/app/services/ backend/app/main.py backend/tests/
git commit -m "feat: add work order CRUD API routes"
```

---

### Task 7: Add Vehicle CRUD API routes

**Files:**
- Create: `backend/app/schemas/vehicles.py`
- Create: `backend/app/routers/vehicles.py`
- Create: `backend/tests/test_routers/test_vehicles.py`
- Modify: `backend/app/main.py`

Similar pattern to work orders: schemas, router, tests.

**Commit:**

```bash
git add backend/app/routers/ backend/app/schemas/ backend/app/main.py backend/tests/
git commit -m "feat: add vehicle CRUD API routes"
```

---

### Task 8: Add KanbanStage CRUD API routes with default stage seeding

**Files:**
- Create: `backend/app/schemas/kanban_stages.py`
- Create: `backend/app/routers/kanban_stages.py`
- Create: `backend/app/services/kanban_stages.py`
- Create: `backend/tests/test_routers/test_kanban_stages.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/services/auth.py` (seed default stages on org creation)

Add a service function `seed_default_stages(session, org_id)` that creates the 5 default stages. Call it from `AuthService.register()` after creating the org.

**Commit:**

```bash
git add backend/app/ backend/tests/
git commit -m "feat: add Kanban stage CRUD and seed defaults on org creation"
```

---

### Task 9: Run full test suite, lint, and verify

**Step 1:** Run all tests: `uv run pytest -v`
**Step 2:** Lint: `uv run ruff check app tests && uv run ruff format --check app tests`
**Step 3:** Fix any issues
**Step 4:** Commit fixes
