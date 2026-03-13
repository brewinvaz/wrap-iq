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
    await svc.create(
        org.id,
        EquipmentCreate(name="Printer A", equipment_type=EquipmentType.printer),
    )
    await svc.create(
        org.id,
        EquipmentCreate(name="Laminator B", equipment_type=EquipmentType.laminator),
    )
    items, total = await svc.list(org.id)
    assert total == 2
    assert len(items) == 2


async def test_list_filter_by_type(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(
        org.id,
        EquipmentCreate(name="Printer A", equipment_type=EquipmentType.printer),
    )
    await svc.create(
        org.id,
        EquipmentCreate(name="Laminator B", equipment_type=EquipmentType.laminator),
    )
    items, total = await svc.list(org.id, equipment_type=EquipmentType.printer)
    assert total == 1
    assert items[0].equipment_type == EquipmentType.printer


async def test_list_filter_by_active(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(
        org.id,
        EquipmentCreate(name="Active", equipment_type=EquipmentType.printer),
    )
    await svc.create(
        org.id,
        EquipmentCreate(
            name="Inactive",
            equipment_type=EquipmentType.printer,
            is_active=False,
        ),
    )
    items, total = await svc.list(org.id, is_active=True)
    assert total == 1
    assert items[0].name == "Active"


async def test_list_search(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(
        org.id,
        EquipmentCreate(
            name="Roland VG3",
            serial_number="SN-100",
            equipment_type=EquipmentType.printer,
        ),
    )
    await svc.create(
        org.id,
        EquipmentCreate(name="GBC Falcon", equipment_type=EquipmentType.laminator),
    )
    items, total = await svc.list(org.id, search="roland")
    assert total == 1
    assert items[0].name == "Roland VG3"
    # Search by serial number
    items2, total2 = await svc.list(org.id, search="SN-100")
    assert total2 == 1


async def test_update_equipment(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    eq = await svc.create(
        org.id,
        EquipmentCreate(name="Old Name", equipment_type=EquipmentType.printer),
    )
    updated = await svc.update(eq.id, org.id, EquipmentUpdate(name="New Name"))
    assert updated.name == "New Name"
    assert updated.equipment_type == EquipmentType.printer  # unchanged


async def test_delete_equipment(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    eq = await svc.create(
        org.id,
        EquipmentCreate(name="To Delete", equipment_type=EquipmentType.plotter),
    )
    await svc.delete(eq.id, org.id)
    fetched = await svc.get(eq.id, org.id)
    assert fetched is None


async def test_get_stats(db_session):
    org = await _seed(db_session)
    svc = EquipmentService(db_session)
    await svc.create(
        org.id,
        EquipmentCreate(name="P1", equipment_type=EquipmentType.printer),
    )
    await svc.create(
        org.id,
        EquipmentCreate(
            name="P2", equipment_type=EquipmentType.printer, is_active=False
        ),
    )
    await svc.create(
        org.id,
        EquipmentCreate(name="L1", equipment_type=EquipmentType.laminator),
    )
    await svc.create(
        org.id,
        EquipmentCreate(name="O1", equipment_type=EquipmentType.other),
    )
    stats = await svc.get_stats(org.id)
    assert stats.total == 4
    assert stats.active == 3
    assert stats.printers == 2
    assert stats.other == 1
