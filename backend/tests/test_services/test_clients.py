import uuid

import pytest

from app.models.client import ClientType
from app.models.organization import Organization
from app.models.plan import Plan
from app.schemas.clients import ClientCreate, ClientUpdate
from app.services.clients import ClientService


async def _seed(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.flush()

    org = Organization(id=uuid.uuid4(), name="Shop", slug="shop", plan_id=plan.id)
    db_session.add(org)
    await db_session.flush()
    return org


async def test_create_client(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    client = await service.create(
        org.id,
        ClientCreate(name="John Doe", email="john@example.com"),
    )
    assert client.name == "John Doe"
    assert client.client_type == ClientType.personal
    assert client.email == "john@example.com"
    assert client.organization_id == org.id
    assert client.is_active is True
    assert client.parent_id is None


async def test_create_business_client(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    client = await service.create(
        org.id,
        ClientCreate(
            name="Fleet Corp",
            client_type=ClientType.business,
            phone="555-0100",
        ),
    )
    assert client.name == "Fleet Corp"
    assert client.client_type == ClientType.business
    assert client.phone == "555-0100"


async def test_create_sub_client(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    parent = await service.create(
        org.id,
        ClientCreate(name="Dealership", client_type=ClientType.business),
    )

    sub = await service.add_sub_client(
        parent.id,
        org.id,
        ClientCreate(name="Location A"),
    )
    assert sub.parent_id == parent.id
    assert sub.name == "Location A"


async def test_sub_client_must_have_business_parent(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    parent = await service.create(
        org.id,
        ClientCreate(name="Personal Client", client_type=ClientType.personal),
    )

    with pytest.raises(ValueError, match="business account"):
        await service.add_sub_client(
            parent.id,
            org.id,
            ClientCreate(name="Sub"),
        )


async def test_no_nested_sub_clients(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    parent = await service.create(
        org.id,
        ClientCreate(name="Parent", client_type=ClientType.business),
    )
    sub = await service.add_sub_client(
        parent.id,
        org.id,
        ClientCreate(name="Sub", client_type=ClientType.business),
    )

    with pytest.raises(ValueError, match="cannot have sub-clients"):
        await service.add_sub_client(
            sub.id,
            org.id,
            ClientCreate(name="Nested"),
        )


async def test_list_clients(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="Client A"))
    await service.create(org.id, ClientCreate(name="Client B"))

    items, total = await service.list(org.id)
    assert total == 2
    assert len(items) == 2


async def test_list_parent_only(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    parent = await service.create(
        org.id,
        ClientCreate(name="Parent", client_type=ClientType.business),
    )
    await service.add_sub_client(parent.id, org.id, ClientCreate(name="Sub"))

    items, total = await service.list(org.id, parent_only=True)
    assert total == 1
    assert items[0].name == "Parent"


async def test_list_by_parent_id(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    parent = await service.create(
        org.id,
        ClientCreate(name="Parent", client_type=ClientType.business),
    )
    await service.add_sub_client(parent.id, org.id, ClientCreate(name="Sub A"))
    await service.add_sub_client(parent.id, org.id, ClientCreate(name="Sub B"))

    items, total = await service.list(org.id, parent_id=parent.id)
    assert total == 2
    names = {c.name for c in items}
    assert names == {"Sub A", "Sub B"}


async def test_update_client(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    client = await service.create(
        org.id, ClientCreate(name="Old Name", email="old@x.com")
    )
    updated = await service.update(
        client.id, org.id, ClientUpdate(name="New Name", is_active=False)
    )
    assert updated.name == "New Name"
    assert updated.is_active is False
    assert updated.email == "old@x.com"


async def test_get_aggregate_report(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    parent = await service.create(
        org.id,
        ClientCreate(name="Fleet Co", client_type=ClientType.business),
    )
    sub = await service.add_sub_client(parent.id, org.id, ClientCreate(name="Branch 1"))

    # Create work orders linked to parent and sub-client
    from datetime import UTC, datetime

    from app.models.kanban_stage import KanbanStage, SystemStatus
    from app.models.work_order import WorkOrder

    stage = KanbanStage(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Lead",
        color="#000",
        position=0,
        system_status=SystemStatus.LEAD,
    )
    db_session.add(stage)
    await db_session.flush()

    wo1 = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-0001",
        status_id=stage.id,
        job_value=5000,
        date_in=datetime.now(UTC),
        client_id=parent.id,
    )
    wo2 = WorkOrder(
        id=uuid.uuid4(),
        organization_id=org.id,
        job_number="WO-0002",
        status_id=stage.id,
        job_value=3000,
        date_in=datetime.now(UTC),
        client_id=sub.id,
    )
    db_session.add_all([wo1, wo2])
    await db_session.commit()

    report = await service.get_aggregate_report(parent.id, org.id)
    assert report["client_name"] == "Fleet Co"
    assert report["total_projects"] == 1
    assert report["total_revenue"] == 5000
    assert report["sub_client_count"] == 1
    assert report["sub_client_projects"] == 1
    assert report["sub_client_revenue"] == 3000
    assert report["combined_projects"] == 2
    assert report["combined_revenue"] == 8000


async def test_lookup_returns_active_clients(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="Alpha Corp"))
    await service.create(org.id, ClientCreate(name="Beta LLC"))

    items = await service.lookup(org.id)
    assert len(items) == 2
    # Ordered alphabetically by name
    assert items[0].name == "Alpha Corp"
    assert items[1].name == "Beta LLC"


async def test_lookup_excludes_inactive_clients(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    c = await service.create(org.id, ClientCreate(name="Inactive Co"))
    await service.update(c.id, org.id, ClientUpdate(is_active=False))
    await service.create(org.id, ClientCreate(name="Active Co"))

    items = await service.lookup(org.id)
    assert len(items) == 1
    assert items[0].name == "Active Co"


async def test_lookup_filters_by_search_term(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="Alpha Corp"))
    await service.create(org.id, ClientCreate(name="Beta LLC"))
    await service.create(org.id, ClientCreate(name="Gamma Alpha Inc"))

    items = await service.lookup(org.id, search="alpha")
    assert len(items) == 2
    names = {i.name for i in items}
    assert names == {"Alpha Corp", "Gamma Alpha Inc"}


async def test_lookup_search_is_case_insensitive(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="UPPER CASE"))

    items = await service.lookup(org.id, search="upper")
    assert len(items) == 1
    assert items[0].name == "UPPER CASE"


async def test_lookup_escapes_ilike_wildcards(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="100% Wraps"))
    await service.create(org.id, ClientCreate(name="Normal Client"))

    items = await service.lookup(org.id, search="100%")
    assert len(items) == 1
    assert items[0].name == "100% Wraps"


async def test_lookup_respects_limit(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    for i in range(5):
        await service.create(org.id, ClientCreate(name=f"Client {i:02d}"))

    items = await service.lookup(org.id, limit=3)
    assert len(items) == 3


async def test_lookup_treats_whitespace_search_as_empty(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="Any Client"))

    items = await service.lookup(org.id, search="   ")
    assert len(items) == 1


async def test_lookup_scoped_to_organization(db_session):
    org = await _seed(db_session)
    service = ClientService(db_session)

    await service.create(org.id, ClientCreate(name="My Client"))

    other_org_id = uuid.uuid4()
    items = await service.lookup(other_org_id)
    assert len(items) == 0
