# Equipment Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Equipment Management — database model, CRUD API, Equipment page UI, and Work Order wizard Production tab integration.

**Architecture:** New Equipment model with EquipmentType enum, CRUD service/router following existing ClientService pattern. Replace ProductionDetails.assigned_equipment string with three FK columns (printer_id, laminator_id, plotter_id). Frontend Equipment page as two-panel layout at /dashboard/equipment, Production tab swaps static buttons for Select dropdowns.

**Tech Stack:** SQLAlchemy + Alembic (backend), FastAPI + Pydantic (API), React 19 + Next.js 15 + Tailwind CSS 4 (frontend)

**Spec:** `docs/superpowers/specs/2026-03-13-equipment-management-design.md`

---

## File Structure

### Backend — Create
- `backend/app/models/equipment.py` — Equipment model + EquipmentType enum
- `backend/app/schemas/equipment.py` — Pydantic schemas (Create, Update, Response, ListResponse, Stats)
- `backend/app/services/equipment.py` — EquipmentService class (CRUD + stats)
- `backend/app/routers/equipment.py` — API router (/api/equipment)
- `backend/alembic/versions/<next>_add_equipment_table.py` — Migration
- `backend/tests/test_services/test_equipment.py` — Service tests
- `backend/tests/test_routers/test_equipment.py` — Router tests

### Backend — Modify
- `backend/app/models/__init__.py` — Register Equipment + EquipmentType
- `backend/app/models/production_details.py` — Replace assigned_equipment with FK columns
- `backend/app/schemas/production_details.py` — Update schemas for FK fields
- `backend/app/main.py` — Register equipment router
- `backend/app/routers/work_orders.py` — Add equipment FK validation

### Frontend — Create
- `frontend/src/lib/api/equipment.ts` — API layer (fetch, create, update, delete, stats)
- `frontend/src/components/equipment/EquipmentPage.tsx` — Main two-panel page component
- `frontend/src/components/equipment/EquipmentList.tsx` — Left panel list
- `frontend/src/components/equipment/EquipmentDetail.tsx` — Right panel detail view
- `frontend/src/components/equipment/EquipmentModal.tsx` — Add/Edit modal
- `frontend/src/components/equipment/EquipmentStats.tsx` — Stats cards

### Frontend — Modify
- `frontend/src/app/dashboard/equipment/page.tsx` — Replace placeholder with EquipmentPage
- `frontend/src/components/work-orders/wizard/types.ts` — Update ProductionState fields
- `frontend/src/components/work-orders/wizard/ProductionTab.tsx` — Replace buttons with Select dropdowns
- `frontend/src/components/work-orders/CreateWorkOrderModal.tsx` — Update payload mapping

---

## Chunk 1: Backend Model, Migration, and Service

### Task 1: Equipment Model and Enum

**Files:**
- Create: `backend/app/models/equipment.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create Equipment model**

```python
# backend/app/models/equipment.py
import enum
import uuid

from sqlalchemy import Boolean, Enum, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class EquipmentType(enum.StrEnum):
    printer = "printer"
    laminator = "laminator"
    plotter = "plotter"
    other = "other"


class Equipment(Base, TenantMixin, TimestampMixin):
    __tablename__ = "equipment"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    equipment_type: Mapped[EquipmentType] = mapped_column(
        Enum(EquipmentType, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

- [ ] **Step 2: Register in models __init__.py**

Add to `backend/app/models/__init__.py`:
```python
from app.models.equipment import Equipment, EquipmentType
```
And add `"Equipment"`, `"EquipmentType"` to `__all__`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/equipment.py backend/app/models/__init__.py
git commit -m "feat: add Equipment model and EquipmentType enum"
```

### Task 2: Update ProductionDetails Model

**Files:**
- Modify: `backend/app/models/production_details.py`

- [ ] **Step 1: Replace assigned_equipment with FK columns**

In `backend/app/models/production_details.py`:

Remove:
```python
assigned_equipment: Mapped[str | None] = mapped_column(String(255), nullable=True)
```

Add these imports at top:
```python
from sqlalchemy import Boolean, ForeignKey, Numeric, String, Uuid
```

Add after `work_order_id`:
```python
    printer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("equipment.id"), nullable=True
    )
    laminator_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("equipment.id"), nullable=True
    )
    plotter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("equipment.id"), nullable=True
    )
```

Add relationships after the existing `work_order` relationship:
```python
    printer = relationship("Equipment", foreign_keys=[printer_id])
    laminator = relationship("Equipment", foreign_keys=[laminator_id])
    plotter = relationship("Equipment", foreign_keys=[plotter_id])
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/production_details.py
git commit -m "feat: replace assigned_equipment with printer/laminator/plotter FK columns"
```

### Task 3: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/<next>_add_equipment_table.py`

- [ ] **Step 1: Determine current Alembic head**

```bash
cd backend && docker compose exec backend alembic heads
```

- [ ] **Step 2: Generate migration**

```bash
docker compose exec backend alembic revision --autogenerate -m "add equipment table and production detail FKs"
```

- [ ] **Step 3: Review and edit migration**

Verify the generated migration contains:
1. `op.create_table('equipment', ...)` with all columns + org_id FK + index
2. `op.add_column('production_details', sa.Column('printer_id', ...))` x3
3. `op.create_foreign_key(...)` for each FK
4. `op.drop_column('production_details', 'assigned_equipment')`

The `downgrade()` must:
1. Drop the three FK columns from production_details
2. Re-add `assigned_equipment` as `String(255), nullable=True`
3. Drop the `equipment` table

- [ ] **Step 4: Run migration**

```bash
make migrate
```

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: migration for equipment table and production detail FKs"
```

### Task 4: Equipment Schemas

**Files:**
- Create: `backend/app/schemas/equipment.py`
- Modify: `backend/app/schemas/production_details.py`

- [ ] **Step 1: Create equipment schemas**

```python
# backend/app/schemas/equipment.py
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.equipment import EquipmentType


class EquipmentCreate(BaseModel):
    name: str
    serial_number: str | None = None
    equipment_type: EquipmentType
    is_active: bool = True


class EquipmentUpdate(BaseModel):
    name: str | None = None
    serial_number: str | None = None
    equipment_type: EquipmentType | None = None
    is_active: bool | None = None


class EquipmentResponse(BaseModel):
    id: uuid.UUID
    name: str
    serial_number: str | None
    equipment_type: EquipmentType
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EquipmentListResponse(BaseModel):
    items: list[EquipmentResponse]
    total: int


class EquipmentStats(BaseModel):
    total: int
    active: int
    printers: int
    other: int
```

- [ ] **Step 2: Update production_details schemas**

Replace `backend/app/schemas/production_details.py` entirely:

```python
import uuid

from pydantic import BaseModel


class ProductionDetailsCreate(BaseModel):
    printer_id: uuid.UUID | None = None
    laminator_id: uuid.UUID | None = None
    plotter_id: uuid.UUID | None = None
    print_media_brand_type: str | None = None
    laminate_brand_type: str | None = None
    window_perf_details: dict | None = None


class ProductionDetailsUpdate(BaseModel):
    printer_id: uuid.UUID | None = None
    laminator_id: uuid.UUID | None = None
    plotter_id: uuid.UUID | None = None
    print_media_brand_type: str | None = None
    laminate_brand_type: str | None = None
    window_perf_details: dict | None = None


class ProductionDetailsResponse(BaseModel):
    printer_id: uuid.UUID | None = None
    laminator_id: uuid.UUID | None = None
    plotter_id: uuid.UUID | None = None
    print_media_brand_type: str | None = None
    print_media_width: str | None = None
    laminate_brand_type: str | None = None
    laminate_width: str | None = None
    window_perf_details: dict | None = None

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/equipment.py backend/app/schemas/production_details.py
git commit -m "feat: add equipment schemas, update production_details schemas for FK fields"
```

### Task 5: Equipment Service with Tests (TDD)

**Files:**
- Create: `backend/app/services/equipment.py`
- Create: `backend/tests/test_services/test_equipment.py`

- [ ] **Step 1: Write the service tests**

```python
# backend/tests/test_services/test_equipment.py
import uuid

import pytest

from app.models.equipment import EquipmentType
from app.models.organization import Organization
from app.models.plan import Plan
from app.schemas.equipment import EquipmentCreate, EquipmentUpdate
from app.services.equipment import EquipmentService


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()
    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


async def test_create_equipment(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    eq = await svc.create(
        org.id,
        EquipmentCreate(name="Roland VG3-640", equipment_type=EquipmentType.printer),
    )
    assert eq.name == "Roland VG3-640"
    assert eq.equipment_type == EquipmentType.printer
    assert eq.is_active is True
    assert eq.organization_id == org.id


async def test_create_with_serial_number(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    eq = await svc.create(
        org.id,
        EquipmentCreate(
            name="GBC Falcon",
            serial_number="SN-001",
            equipment_type=EquipmentType.laminator,
        ),
    )
    assert eq.serial_number == "SN-001"


async def test_get_equipment(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    eq = await svc.create(
        org.id,
        EquipmentCreate(name="Test Printer", equipment_type=EquipmentType.printer),
    )
    fetched = await svc.get(eq.id, org.id)
    assert fetched is not None
    assert fetched.id == eq.id


async def test_get_equipment_wrong_org(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    eq = await svc.create(
        org.id,
        EquipmentCreate(name="Test Printer", equipment_type=EquipmentType.printer),
    )
    fetched = await svc.get(eq.id, uuid.uuid4())
    assert fetched is None


async def test_list_equipment(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(org.id, EquipmentCreate(name="Printer A", equipment_type=EquipmentType.printer))
    await svc.create(org.id, EquipmentCreate(name="Laminator B", equipment_type=EquipmentType.laminator))
    items, total = await svc.list(org.id)
    assert total == 2
    assert len(items) == 2


async def test_list_filter_by_type(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(org.id, EquipmentCreate(name="Printer A", equipment_type=EquipmentType.printer))
    await svc.create(org.id, EquipmentCreate(name="Laminator B", equipment_type=EquipmentType.laminator))
    items, total = await svc.list(org.id, equipment_type=EquipmentType.printer)
    assert total == 1
    assert items[0].equipment_type == EquipmentType.printer


async def test_list_filter_by_active(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(org.id, EquipmentCreate(name="Active", equipment_type=EquipmentType.printer))
    await svc.create(
        org.id,
        EquipmentCreate(name="Inactive", equipment_type=EquipmentType.printer, is_active=False),
    )
    items, total = await svc.list(org.id, is_active=True)
    assert total == 1
    assert items[0].name == "Active"


async def test_list_search(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(
        org.id,
        EquipmentCreate(name="Roland VG3", serial_number="SN-100", equipment_type=EquipmentType.printer),
    )
    await svc.create(org.id, EquipmentCreate(name="GBC Falcon", equipment_type=EquipmentType.laminator))
    items, total = await svc.list(org.id, search="roland")
    assert total == 1
    assert items[0].name == "Roland VG3"
    # Search by serial number
    items2, total2 = await svc.list(org.id, search="SN-100")
    assert total2 == 1


async def test_update_equipment(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    eq = await svc.create(org.id, EquipmentCreate(name="Old Name", equipment_type=EquipmentType.printer))
    updated = await svc.update(eq.id, org.id, EquipmentUpdate(name="New Name"))
    assert updated.name == "New Name"
    assert updated.equipment_type == EquipmentType.printer  # unchanged


async def test_delete_equipment(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    eq = await svc.create(org.id, EquipmentCreate(name="To Delete", equipment_type=EquipmentType.plotter))
    await svc.delete(eq.id, org.id)
    fetched = await svc.get(eq.id, org.id)
    assert fetched is None


async def test_get_stats(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(org.id, EquipmentCreate(name="P1", equipment_type=EquipmentType.printer))
    await svc.create(org.id, EquipmentCreate(name="P2", equipment_type=EquipmentType.printer, is_active=False))
    await svc.create(org.id, EquipmentCreate(name="L1", equipment_type=EquipmentType.laminator))
    await svc.create(org.id, EquipmentCreate(name="O1", equipment_type=EquipmentType.other))
    stats = await svc.get_stats(org.id)
    assert stats.total == 4
    assert stats.active == 3
    assert stats.printers == 2
    assert stats.other == 1
```

- [ ] **Step 2: Run tests — expect FAIL (service doesn't exist)**

```bash
make test -- tests/test_services/test_equipment.py -v
```

- [ ] **Step 3: Write the EquipmentService**

```python
# backend/app/services/equipment.py
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.equipment import Equipment, EquipmentType
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentStats,
    EquipmentUpdate,
)


class EquipmentService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, org_id: uuid.UUID, data: EquipmentCreate) -> Equipment:
        equipment = Equipment(
            id=uuid.uuid4(),
            organization_id=org_id,
            name=data.name,
            serial_number=data.serial_number,
            equipment_type=data.equipment_type,
            is_active=data.is_active,
        )
        self.session.add(equipment)
        await self.session.commit()
        await self.session.refresh(equipment)
        return equipment

    async def get(self, equipment_id: uuid.UUID, org_id: uuid.UUID) -> Equipment | None:
        result = await self.session.execute(
            select(Equipment).where(
                Equipment.id == equipment_id,
                Equipment.organization_id == org_id,
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        org_id: uuid.UUID,
        equipment_type: EquipmentType | None = None,
        is_active: bool | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Equipment], int]:
        query = select(Equipment).where(Equipment.organization_id == org_id)
        count_query = select(func.count(Equipment.id)).where(
            Equipment.organization_id == org_id
        )

        if equipment_type is not None:
            query = query.where(Equipment.equipment_type == equipment_type)
            count_query = count_query.where(Equipment.equipment_type == equipment_type)

        if is_active is not None:
            query = query.where(Equipment.is_active == is_active)
            count_query = count_query.where(Equipment.is_active == is_active)

        if search:
            pattern = f"%{search}%"
            search_filter = or_(
                Equipment.name.ilike(pattern),
                Equipment.serial_number.ilike(pattern),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(Equipment.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all()), total

    async def update(
        self, equipment_id: uuid.UUID, org_id: uuid.UUID, data: EquipmentUpdate
    ) -> Equipment:
        equipment = await self.get(equipment_id, org_id)
        if not equipment:
            raise ValueError("Equipment not found")
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(equipment, key, value)
        await self.session.commit()
        await self.session.refresh(equipment)
        return equipment

    async def delete(self, equipment_id: uuid.UUID, org_id: uuid.UUID) -> None:
        equipment = await self.get(equipment_id, org_id)
        if not equipment:
            raise ValueError("Equipment not found")
        # Check if equipment is referenced by any production_details
        from app.models.production_details import ProductionDetails

        ref_query = select(func.count(ProductionDetails.id)).where(
            or_(
                ProductionDetails.printer_id == equipment_id,
                ProductionDetails.laminator_id == equipment_id,
                ProductionDetails.plotter_id == equipment_id,
            )
        )
        ref_result = await self.session.execute(ref_query)
        ref_count = ref_result.scalar() or 0
        if ref_count > 0:
            raise ValueError("Equipment is assigned to work orders and cannot be deleted")
        await self.session.delete(equipment)
        await self.session.commit()

    async def get_stats(self, org_id: uuid.UUID) -> EquipmentStats:
        base = Equipment.organization_id == org_id
        total_q = select(func.count(Equipment.id)).where(base)
        active_q = select(func.count(Equipment.id)).where(base, Equipment.is_active.is_(True))
        printers_q = select(func.count(Equipment.id)).where(
            base, Equipment.equipment_type == EquipmentType.printer
        )
        other_q = select(func.count(Equipment.id)).where(
            base, Equipment.equipment_type == EquipmentType.other
        )
        total = (await self.session.execute(total_q)).scalar() or 0
        active = (await self.session.execute(active_q)).scalar() or 0
        printers = (await self.session.execute(printers_q)).scalar() or 0
        other = (await self.session.execute(other_q)).scalar() or 0
        return EquipmentStats(total=total, active=active, printers=printers, other=other)
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
make test -- tests/test_services/test_equipment.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/equipment.py backend/tests/test_services/test_equipment.py
git commit -m "feat: add EquipmentService with CRUD, stats, search, and tests"
```

### Task 6: Equipment Router with Tests (TDD)

**Files:**
- Create: `backend/app/routers/equipment.py`
- Create: `backend/tests/test_routers/test_equipment.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write router tests**

```python
# backend/tests/test_routers/test_equipment.py
import pytest


async def _register_and_get_token(client):
    resp = await client.post(
        "/api/auth/register",
        json={
            "email": "admin@shop.com",
            "password": "TestPass123!",
            "org_name": "My Shop",
        },
    )
    return resp.json()["access_token"]


async def test_create_equipment(client, db_session):
    token = await _register_and_get_token(client)
    resp = await client.post(
        "/api/equipment",
        json={
            "name": "Roland VG3-640",
            "serial_number": "SN-001",
            "equipment_type": "printer",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Roland VG3-640"
    assert data["equipment_type"] == "printer"
    assert data["is_active"] is True


async def test_list_equipment(client, db_session):
    token = await _register_and_get_token(client)
    await client.post(
        "/api/equipment",
        json={"name": "Printer A", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/equipment",
        json={"name": "Laminator B", "equipment_type": "laminator"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/equipment",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_list_filter_by_type(client, db_session):
    token = await _register_and_get_token(client)
    await client.post(
        "/api/equipment",
        json={"name": "Printer A", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/equipment",
        json={"name": "Laminator B", "equipment_type": "laminator"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/equipment?equipment_type=printer",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_list_filter_by_active(client, db_session):
    token = await _register_and_get_token(client)
    await client.post(
        "/api/equipment",
        json={"name": "Active", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/equipment",
        json={"name": "Inactive", "equipment_type": "printer", "is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/equipment?is_active=true",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_get_equipment(client, db_session):
    token = await _register_and_get_token(client)
    create_resp = await client.post(
        "/api/equipment",
        json={"name": "Test", "equipment_type": "plotter"},
        headers={"Authorization": f"Bearer {token}"},
    )
    eq_id = create_resp.json()["id"]
    resp = await client.get(
        f"/api/equipment/{eq_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test"


async def test_update_equipment(client, db_session):
    token = await _register_and_get_token(client)
    create_resp = await client.post(
        "/api/equipment",
        json={"name": "Old", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    eq_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/equipment/{eq_id}",
        json={"name": "New"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"


async def test_delete_equipment(client, db_session):
    token = await _register_and_get_token(client)
    create_resp = await client.post(
        "/api/equipment",
        json={"name": "Delete Me", "equipment_type": "other"},
        headers={"Authorization": f"Bearer {token}"},
    )
    eq_id = create_resp.json()["id"]
    resp = await client.delete(
        f"/api/equipment/{eq_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204


async def test_get_stats(client, db_session):
    token = await _register_and_get_token(client)
    await client.post(
        "/api/equipment",
        json={"name": "P1", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        "/api/equipment",
        json={"name": "O1", "equipment_type": "other"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get(
        "/api/equipment/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["active"] == 2
    assert data["printers"] == 1
    assert data["other"] == 1


async def test_delete_equipment_in_use_returns_409(client, db_session):
    token = await _register_and_get_token(client)
    # Create equipment
    eq_resp = await client.post(
        "/api/equipment",
        json={"name": "In-Use Printer", "equipment_type": "printer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    eq_id = eq_resp.json()["id"]
    # Create a work order with this printer assigned
    await client.post(
        "/api/work-orders",
        json={
            "job_type": "personal",
            "date_in": "2026-03-13T00:00:00Z",
            "production_details": {"printer_id": eq_id},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    # Attempt to delete — should fail with 409
    resp = await client.delete(
        f"/api/equipment/{eq_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


async def test_unauthorized_returns_401(client, db_session):
    resp = await client.get("/api/equipment")
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
make test -- tests/test_routers/test_equipment.py -v
```

- [ ] **Step 3: Write the equipment router**

```python
# backend/app/routers/equipment.py
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.equipment import EquipmentType
from app.models.user import User
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentListResponse,
    EquipmentResponse,
    EquipmentStats,
    EquipmentUpdate,
)
from app.services.equipment import EquipmentService

logger = logging.getLogger("wrapiq")

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    data: EquipmentCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    try:
        equipment = await service.create(user.organization_id, data)
    except Exception as e:
        logger.exception("Failed to create equipment")
        raise HTTPException(status_code=500, detail="An unexpected error occurred") from e
    return equipment


@router.get("", response_model=EquipmentListResponse)
async def list_equipment(
    search: str | None = Query(None, max_length=200),
    equipment_type: EquipmentType | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    items, total = await service.list(
        user.organization_id,
        equipment_type=equipment_type,
        is_active=is_active,
        search=search,
        skip=skip,
        limit=limit,
    )
    return EquipmentListResponse(
        items=[EquipmentResponse.model_validate(eq) for eq in items],
        total=total,
    )


@router.get("/stats", response_model=EquipmentStats)
async def get_equipment_stats(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    return await service.get_stats(user.organization_id)


@router.get("/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(
    equipment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    equipment = await service.get(equipment_id, user.organization_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.patch("/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: uuid.UUID,
    data: EquipmentUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    try:
        equipment = await service.update(equipment_id, user.organization_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return equipment


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    equipment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = EquipmentService(session)
    try:
        await service.delete(equipment_id, user.organization_id)
    except ValueError as e:
        detail = str(e)
        if "assigned to work orders" in detail:
            raise HTTPException(status_code=409, detail=detail) from e
        raise HTTPException(status_code=404, detail=detail) from e
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/app/main.py` imports:
```python
from app.routers.equipment import router as equipment_router
```

Add to router includes (before `@app.get("/health")`):
```python
app.include_router(equipment_router)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
make test -- tests/test_routers/test_equipment.py -v
```

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
make test
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/equipment.py backend/tests/test_routers/test_equipment.py backend/app/main.py
git commit -m "feat: add equipment CRUD router with tests"
```

### Task 7: Work Order Equipment FK Validation

**Files:**
- Modify: `backend/app/routers/work_orders.py`

- [ ] **Step 1: Add equipment validation helper to work_orders router**

Add to `backend/app/routers/work_orders.py` alongside existing `_validate_vehicle_ownership` and `_validate_client_ownership`:

```python
from app.models.equipment import Equipment, EquipmentType

_EQUIPMENT_SLOTS: dict[str, EquipmentType] = {
    "printer_id": EquipmentType.printer,
    "laminator_id": EquipmentType.laminator,
    "plotter_id": EquipmentType.plotter,
}


async def _validate_equipment_ownership(
    session: AsyncSession,
    production_data: dict | None,
    org_id: uuid.UUID,
) -> None:
    if not production_data:
        return
    for field, expected_type in _EQUIPMENT_SLOTS.items():
        eq_id = production_data.get(field)
        if eq_id is None:
            continue
        result = await session.execute(
            select(Equipment).where(
                Equipment.id == eq_id,
                Equipment.organization_id == org_id,
            )
        )
        equipment = result.scalar_one_or_none()
        if equipment is None:
            raise HTTPException(
                status_code=403,
                detail=f"Equipment not found in your organization",
            )
        if equipment.equipment_type != expected_type:
            raise HTTPException(
                status_code=400,
                detail=f"{field} must reference equipment of type {expected_type.value}",
            )
```

- [ ] **Step 2: Call validation in create and update endpoints**

In the `create` endpoint, add before `wo = await create_work_order(...)`:
```python
    await _validate_equipment_ownership(
        session,
        sub_details.get("production_details"),
        user.organization_id,
    )
```

In the `update` endpoint, if the update payload includes production details fields (`printer_id`, `laminator_id`, `plotter_id`), extract them and call `_validate_equipment_ownership` the same way. Check how the existing `update` endpoint handles sub-details — if it allows updating production_details, add the validation call before the update is applied.

- [ ] **Step 3: Run full test suite**

```bash
make test
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/work_orders.py
git commit -m "feat: add equipment FK validation to work order create/update"
```

---

## Chunk 2: Frontend Equipment Page

### Task 8: Frontend API Layer

**Files:**
- Create: `frontend/src/lib/api/equipment.ts`

- [ ] **Step 1: Create equipment API functions**

```typescript
// frontend/src/lib/api/equipment.ts
import { api } from '../api-client';

export type EquipmentType = 'printer' | 'laminator' | 'plotter' | 'other';

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  printer: 'Printer',
  laminator: 'Laminator',
  plotter: 'Plotter',
  other: 'Other',
};

export interface Equipment {
  id: string;
  name: string;
  serialNumber: string | null;
  equipmentType: EquipmentType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentStats {
  total: number;
  active: number;
  printers: number;
  other: number;
}

interface EquipmentRaw {
  id: string;
  name: string;
  serial_number: string | null;
  equipment_type: EquipmentType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EquipmentStatsRaw {
  total: number;
  active: number;
  printers: number;
  other: number;
}

function mapEquipment(raw: EquipmentRaw): Equipment {
  return {
    id: raw.id,
    name: raw.name,
    serialNumber: raw.serial_number,
    equipmentType: raw.equipment_type,
    isActive: raw.is_active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export async function fetchEquipment(
  search?: string,
  type?: EquipmentType,
  isActive?: boolean,
): Promise<{ items: Equipment[]; total: number }> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (type) params.set('equipment_type', type);
  if (isActive !== undefined) params.set('is_active', String(isActive));
  params.set('limit', '100');
  const qs = params.toString();
  const data = await api.get<{ items: EquipmentRaw[]; total: number }>(
    `/api/equipment${qs ? `?${qs}` : ''}`,
  );
  return { items: data.items.map(mapEquipment), total: data.total };
}

export async function fetchEquipmentStats(): Promise<EquipmentStats> {
  return api.get<EquipmentStatsRaw>('/api/equipment/stats');
}

export async function createEquipment(data: {
  name: string;
  serialNumber?: string;
  equipmentType: EquipmentType;
  isActive: boolean;
}): Promise<Equipment> {
  const raw = await api.post<EquipmentRaw>('/api/equipment', {
    name: data.name,
    serial_number: data.serialNumber || null,
    equipment_type: data.equipmentType,
    is_active: data.isActive,
  });
  return mapEquipment(raw);
}

export async function updateEquipment(
  id: string,
  data: {
    name?: string;
    serialNumber?: string;
    equipmentType?: EquipmentType;
    isActive?: boolean;
  },
): Promise<Equipment> {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.serialNumber !== undefined) payload.serial_number = data.serialNumber;
  if (data.equipmentType !== undefined) payload.equipment_type = data.equipmentType;
  if (data.isActive !== undefined) payload.is_active = data.isActive;
  const raw = await api.patch<EquipmentRaw>(`/api/equipment/${id}`, payload);
  return mapEquipment(raw);
}

export async function deleteEquipment(id: string): Promise<void> {
  await api.delete(`/api/equipment/${id}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api/equipment.ts
git commit -m "feat: add frontend equipment API layer"
```

### Task 9: Equipment Stats Component

**Files:**
- Create: `frontend/src/components/equipment/EquipmentStats.tsx`

- [ ] **Step 1: Create stats cards component**

```typescript
// frontend/src/components/equipment/EquipmentStats.tsx
'use client';

import type { EquipmentStats as EquipmentStatsType } from '@/lib/api/equipment';

interface Props {
  stats: EquipmentStatsType;
}

const CARDS = [
  { key: 'total' as const, label: 'Total Equipment', icon: '⚙️' },
  { key: 'active' as const, label: 'Active Equipment', icon: '✓' },
  { key: 'printers' as const, label: 'Printers', icon: '🖨' },
  { key: 'other' as const, label: 'Other Equipment', icon: '📦' },
];

export default function EquipmentStatsBar({ stats }: Props) {
  return (
    <div className="grid grid-cols-4 gap-3 border-t border-[var(--border)] px-6 py-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
        >
          <span className="text-lg">{card.icon}</span>
          <div>
            <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">
              {stats[card.key]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/equipment/EquipmentStats.tsx
git commit -m "feat: add EquipmentStats component"
```

### Task 10: Equipment List Component

**Files:**
- Create: `frontend/src/components/equipment/EquipmentList.tsx`

- [ ] **Step 1: Create list component**

```typescript
// frontend/src/components/equipment/EquipmentList.tsx
'use client';

import type { Equipment } from '@/lib/api/equipment';
import { EQUIPMENT_TYPE_LABELS } from '@/lib/api/equipment';

interface Props {
  items: Equipment[];
  selectedId: string | null;
  onSelect: (eq: Equipment) => void;
}

export default function EquipmentList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-xs text-[var(--text-muted)]">No equipment matches your filters</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((eq) => (
        <button
          key={eq.id}
          type="button"
          onClick={() => onSelect(eq)}
          className={`w-full border-b border-[var(--border)] px-4 py-3 text-left transition-colors ${
            selectedId === eq.id
              ? 'border-l-[3px] border-l-[var(--accent-primary)] bg-[var(--surface-raised)]'
              : 'hover:bg-[var(--surface-raised)]/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {eq.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                eq.isActive
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {eq.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {EQUIPMENT_TYPE_LABELS[eq.equipmentType] ?? eq.equipmentType}
            {eq.serialNumber ? ` · ${eq.serialNumber}` : ''}
          </p>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/equipment/EquipmentList.tsx
git commit -m "feat: add EquipmentList component"
```

### Task 11: Equipment Detail Component

**Files:**
- Create: `frontend/src/components/equipment/EquipmentDetail.tsx`

- [ ] **Step 1: Create detail component**

```typescript
// frontend/src/components/equipment/EquipmentDetail.tsx
'use client';

import type { Equipment } from '@/lib/api/equipment';
import { EQUIPMENT_TYPE_LABELS } from '@/lib/api/equipment';
import { Button } from '@/components/ui/Button';

interface Props {
  equipment: Equipment;
  onEdit: () => void;
  onDelete: () => void;
}

export default function EquipmentDetail({ equipment, onEdit, onDelete }: Props) {
  const addedDate = new Date(equipment.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {equipment.name}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Added {addedDate}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Equipment Type
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
            {EQUIPMENT_TYPE_LABELS[equipment.equipmentType] ?? equipment.equipmentType}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Serial Number
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
            {equipment.serialNumber || '—'}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Status
          </p>
          <p
            className={`mt-1 text-sm font-medium ${
              equipment.isActive ? 'text-green-400' : 'text-amber-400'
            }`}
          >
            {equipment.isActive ? '● Active' : '● Inactive'}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/equipment/EquipmentDetail.tsx
git commit -m "feat: add EquipmentDetail component"
```

### Task 12: Equipment Modal (Add/Edit)

**Files:**
- Create: `frontend/src/components/equipment/EquipmentModal.tsx`

- [ ] **Step 1: Create modal component**

```typescript
// frontend/src/components/equipment/EquipmentModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import type { Equipment, EquipmentType } from '@/lib/api/equipment';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    serialNumber?: string;
    equipmentType: EquipmentType;
    isActive: boolean;
  }) => Promise<void>;
  equipment?: Equipment | null;
}

const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'printer', label: 'Printer' },
  { value: 'laminator', label: 'Laminator' },
  { value: 'plotter', label: 'Plotter' },
  { value: 'other', label: 'Other' },
];

export default function EquipmentModal({ isOpen, onClose, onSubmit, equipment }: Props) {
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('printer');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isEdit = !!equipment;

  useEffect(() => {
    if (equipment) {
      setName(equipment.name);
      setSerialNumber(equipment.serialNumber || '');
      setEquipmentType(equipment.equipmentType);
      setIsActive(equipment.isActive);
    } else {
      setName('');
      setSerialNumber('');
      setEquipmentType('printer');
      setIsActive(true);
    }
    setError(null);
  }, [equipment, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        serialNumber: serialNumber.trim() || undefined,
        equipmentType,
        isActive,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-modal-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface-card)] p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="equipment-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
            {isEdit ? 'Edit Equipment' : 'Add Equipment'}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="eq-name" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                Equipment Name *
              </label>
              <input
                id="eq-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter equipment name/model"
                className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label htmlFor="eq-serial" className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                Serial Number
              </label>
              <input
                id="eq-serial"
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Enter serial number (optional)"
                className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                Equipment Type *
              </label>
              <Select
                value={equipmentType}
                onChange={(val) => setEquipmentType(val as EquipmentType)}
                options={EQUIPMENT_TYPE_OPTIONS}
              />
            </div>
            <label className="flex items-center gap-2 pb-2.5">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-primary)]"
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Equipment is active and available
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting || !name.trim()}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Equipment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/equipment/EquipmentModal.tsx
git commit -m "feat: add EquipmentModal component for add/edit"
```

### Task 13: Equipment Page (Main Component)

**Files:**
- Create: `frontend/src/components/equipment/EquipmentPage.tsx`
- Modify: `frontend/src/app/dashboard/equipment/page.tsx`

- [ ] **Step 1: Create main EquipmentPage component**

```typescript
// frontend/src/components/equipment/EquipmentPage.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { ApiError } from '@/lib/api-client';
import type { Equipment, EquipmentType, EquipmentStats as EquipmentStatsType } from '@/lib/api/equipment';
import {
  fetchEquipment,
  fetchEquipmentStats,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from '@/lib/api/equipment';
import EquipmentList from './EquipmentList';
import EquipmentDetail from './EquipmentDetail';
import EquipmentModal from './EquipmentModal';
import EquipmentStatsBar from './EquipmentStats';

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'printer', label: 'Printer' },
  { value: 'laminator', label: 'Laminator' },
  { value: 'plotter', label: 'Plotter' },
  { value: 'other', label: 'Other' },
];

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [stats, setStats] = useState<EquipmentStatsType>({ total: 0, active: 0, printers: 0, other: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [listData, statsData] = await Promise.all([
        fetchEquipment(
          search || undefined,
          (typeFilter as EquipmentType) || undefined,
        ),
        fetchEquipmentStats(),
      ]);
      setEquipment(listData.items);
      setStats(statsData);
      // Keep selection if still in list
      if (selected) {
        const stillExists = listData.items.find((e) => e.id === selected.id);
        if (!stillExists) setSelected(listData.items[0] ?? null);
        else setSelected(stillExists);
      } else if (listData.items.length > 0) {
        setSelected(listData.items[0]);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load equipment';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(data: {
    name: string;
    serialNumber?: string;
    equipmentType: EquipmentType;
    isActive: boolean;
  }) {
    await createEquipment(data);
    await loadData();
  }

  async function handleUpdate(data: {
    name: string;
    serialNumber?: string;
    equipmentType: EquipmentType;
    isActive: boolean;
  }) {
    if (!editingEquipment) return;
    await updateEquipment(editingEquipment.id, data);
    setEditingEquipment(null);
    await loadData();
  }

  async function handleDelete() {
    if (!selected) return;
    if (!window.confirm(`Delete "${selected.name}"? This cannot be undone.`)) return;
    try {
      await deleteEquipment(selected.id);
      setSelected(null);
      await loadData();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete equipment';
      setError(message);
    }
  }

  function openEdit() {
    if (!selected) return;
    setEditingEquipment(selected);
    setModalOpen(true);
  }

  function openCreate() {
    setEditingEquipment(null);
    setModalOpen(true);
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
          <div className="h-6 w-48 animate-pulse rounded bg-[var(--surface-raised)]" />
        </div>
        <div className="flex flex-1">
          <div className="w-72 shrink-0 border-r border-[var(--border)] p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mb-3 h-16 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
            ))}
          </div>
          <div className="flex-1 p-6">
            <div className="h-48 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error && equipment.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--surface-app)]">
        <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load equipment</p>
        <p className="text-xs text-[var(--text-secondary)]">{error}</p>
        <Button onClick={loadData}>Retry</Button>
      </div>
    );
  }

  const isEmpty = equipment.length === 0 && !search && !typeFilter;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <div>
          <h1 className="text-[22px] font-[800] tracking-[-0.4px] text-[var(--text-primary)]">
            Equipment Management
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Manage your shop equipment inventory and track usage
          </p>
        </div>
        <Button onClick={openCreate}>+ Add Equipment</Button>
      </header>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center">
            <svg
              width="48"
              height="48"
              fill="none"
              viewBox="0 0 24 24"
              className="text-[var(--text-muted)]"
            >
              <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
              No Equipment Added
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Start by adding your first piece of equipment to track usage on work orders.
            </p>
            <Button onClick={openCreate} className="mt-4">
              + Add First Equipment
            </Button>
          </div>
          <EquipmentStatsBar stats={stats} />
        </div>
      ) : (
        /* Populated state */
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Search + Filter */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search equipment by name or serial number..."
                className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3.5 py-2 pl-9 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
            </div>
            <div className="w-40">
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                options={TYPE_FILTER_OPTIONS}
              />
            </div>
          </div>

          {/* Two-panel content */}
          <div className="flex min-h-0 flex-1">
            <div className="flex w-72 shrink-0 flex-col border-r border-[var(--border)]">
              <EquipmentList
                items={equipment}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            </div>
            {selected ? (
              <EquipmentDetail
                equipment={selected}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-[var(--text-muted)]">
                  Select equipment to view details
                </p>
              </div>
            )}
          </div>

          <EquipmentStatsBar stats={stats} />
        </div>
      )}

      {/* Modal */}
      <EquipmentModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEquipment(null);
        }}
        onSubmit={editingEquipment ? handleUpdate : handleCreate}
        equipment={editingEquipment}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update the page.tsx to use EquipmentPage**

Replace the contents of `frontend/src/app/dashboard/equipment/page.tsx`:

```typescript
'use client';

import EquipmentPage from '@/components/equipment/EquipmentPage';

export default function EquipmentRoute() {
  return <EquipmentPage />;
}
```

- [ ] **Step 3: Verify in browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:3000/dashboard/equipment — verify empty state renders with stats cards.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/equipment/EquipmentPage.tsx frontend/src/app/dashboard/equipment/page.tsx
git commit -m "feat: add Equipment page with two-panel layout, search, filter, and CRUD"
```

---

## Chunk 3: Work Order Wizard Integration

### Task 14: Update ProductionState Types

**Files:**
- Modify: `frontend/src/components/work-orders/wizard/types.ts`

- [ ] **Step 1: Update ProductionState interface and initial state**

In `frontend/src/components/work-orders/wizard/types.ts`:

Replace the `ProductionState` interface:
```typescript
export interface ProductionState {
  printerId: string;
  laminatorId: string;
  plotterId: string;
  printMedia: string;
  laminate: string;
  windowPerf: string;
  productionNotes: string;
}
```

Replace `INITIAL_PRODUCTION`:
```typescript
export const INITIAL_PRODUCTION: ProductionState = {
  printerId: '',
  laminatorId: '',
  plotterId: '',
  printMedia: '',
  laminate: '',
  windowPerf: '',
  productionNotes: '',
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/types.ts
git commit -m "feat: update ProductionState types for equipment FK fields"
```

### Task 15: Update ProductionTab Component

**Files:**
- Modify: `frontend/src/components/work-orders/wizard/ProductionTab.tsx`

- [ ] **Step 1: Replace static buttons with Select dropdowns**

Replace the Printer/Laminator/Plotter sections in `ProductionTab.tsx`. Add imports:
```typescript
import { useState, useEffect } from 'react';
import Select from '@/components/ui/Select';
import { fetchEquipment } from '@/lib/api/equipment';
import type { Equipment } from '@/lib/api/equipment';
```

Add state and data fetching at the top of the component:
```typescript
export default function ProductionTab({ data, onChange }: Props) {
  const [printers, setPrinters] = useState<Equipment[]>([]);
  const [laminators, setLaminators] = useState<Equipment[]>([]);
  const [plotters, setPlotters] = useState<Equipment[]>([]);

  useEffect(() => {
    async function loadEquipment() {
      const [p, l, c] = await Promise.all([
        fetchEquipment(undefined, 'printer', true),
        fetchEquipment(undefined, 'laminator', true),
        fetchEquipment(undefined, 'plotter', true),
      ]);
      setPrinters(p.items);
      setLaminators(l.items);
      setPlotters(c.items);
    }
    loadEquipment();
  }, []);

  function update(patch: Partial<ProductionState>) {
    onChange({ ...data, ...patch });
  }

  function equipmentOptions(items: Equipment[]) {
    return [
      { value: '', label: 'None' },
      ...items.map((eq) => ({ value: eq.id, label: eq.name })),
    ];
  }
```

Replace the Printer section (lines ~182-197):
```typescript
      {/* ========== Printer ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          <PrinterIcon />
          Printer
        </label>
        <div className="mt-2">
          <Select
            value={data.printerId}
            onChange={(val) => update({ printerId: val })}
            options={equipmentOptions(printers)}
            placeholder="No Printer"
          />
        </div>
      </div>
```

Replace the Laminator section (lines ~199-215):
```typescript
      {/* ========== Laminator ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          <LayersIcon />
          Laminator
        </label>
        <div className="mt-2">
          <Select
            value={data.laminatorId}
            onChange={(val) => update({ laminatorId: val })}
            options={equipmentOptions(laminators)}
            placeholder="No Laminator"
          />
        </div>
      </div>
```

Replace the Plotter/Cutter section (lines ~217-233):
```typescript
      {/* ========== Plotter/Cutter ========== */}
      <div>
        <label className={sectionHeadingClass}>
          <SectionDot />
          <ScissorsIcon />
          Plotter/Cutter
        </label>
        <div className="mt-2">
          <Select
            value={data.plotterId}
            onChange={(val) => update({ plotterId: val })}
            options={equipmentOptions(plotters)}
            placeholder="No Plotter"
          />
        </div>
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/work-orders/wizard/ProductionTab.tsx
git commit -m "feat: replace static equipment buttons with Select dropdowns in ProductionTab"
```

### Task 16: Update CreateWorkOrderModal Payload

**Files:**
- Modify: `frontend/src/components/work-orders/CreateWorkOrderModal.tsx`

- [ ] **Step 1: Update production_details payload mapping**

In `CreateWorkOrderModal.tsx`, find the production details payload section (around lines 189-201) and replace:

```typescript
      // Add production details if any are set
      if (production.printMedia || production.laminate || production.printerId) {
        payload.production_details = {
          printer_id: production.printerId || null,
          laminator_id: production.laminatorId || null,
          plotter_id: production.plotterId || null,
          print_media_brand_type: production.printMedia || null,
          laminate_brand_type: production.laminate || null,
          window_perf_details: production.windowPerf
            ? { type: production.windowPerf }
            : null,
        };
      }
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000, create a work order, and check that the Production tab shows equipment dropdowns populated from the equipment inventory.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/work-orders/CreateWorkOrderModal.tsx
git commit -m "feat: update work order payload to use equipment FK fields"
```

### Task 17: Final Verification

- [ ] **Step 1: Run backend tests**

```bash
make test
```

- [ ] **Step 2: Run linting**

```bash
make lint
```

- [ ] **Step 3: Verify frontend builds**

```bash
cd frontend && npm run build
```

- [ ] **Step 4: Manual smoke test**

1. Open Equipment page → verify empty state
2. Add equipment (printer, laminator, plotter, other) → verify list + stats update
3. Select equipment → verify detail panel
4. Edit equipment → verify changes persist
5. Delete equipment → verify removal
6. Search by name and serial number
7. Filter by type
8. Create work order → Production tab shows equipment dropdowns
9. Select equipment in Production tab → verify payload sends correct IDs

- [ ] **Step 5: Final commit if any fixes needed**
