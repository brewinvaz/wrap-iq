import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client, ClientType
from app.models.work_order import WorkOrder
from app.schemas.clients import ClientCreate, ClientUpdate


class ClientService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, org_id: uuid.UUID, data: ClientCreate) -> Client:
        if data.parent_id:
            parent = await self.get(data.parent_id, org_id)
            if not parent:
                raise ValueError("Parent client not found")
            if parent.client_type != ClientType.BUSINESS:
                raise ValueError("Parent client must be a business account")
            if parent.parent_id is not None:
                raise ValueError("Sub-clients cannot have sub-clients")

        client = Client(
            id=uuid.uuid4(),
            organization_id=org_id,
            name=data.name,
            client_type=data.client_type,
            email=data.email,
            phone=data.phone,
            address=data.address,
            tags=data.tags,
            referral_source=data.referral_source,
            notes=data.notes,
            parent_id=data.parent_id,
        )
        self.session.add(client)
        await self.session.commit()
        await self.session.refresh(client)
        return client

    async def get(self, client_id: uuid.UUID, org_id: uuid.UUID) -> Client | None:
        result = await self.session.execute(
            select(Client)
            .options(selectinload(Client.sub_clients))
            .where(Client.id == client_id, Client.organization_id == org_id)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        org_id: uuid.UUID,
        parent_only: bool = False,
        parent_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Client], int]:
        query = select(Client).where(Client.organization_id == org_id)
        count_query = select(func.count(Client.id)).where(
            Client.organization_id == org_id
        )

        if parent_only:
            query = query.where(Client.parent_id.is_(None))
            count_query = count_query.where(Client.parent_id.is_(None))

        if parent_id is not None:
            query = query.where(Client.parent_id == parent_id)
            count_query = count_query.where(Client.parent_id == parent_id)

        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        query = query.order_by(Client.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all()), total

    async def update(
        self, client_id: uuid.UUID, org_id: uuid.UUID, data: ClientUpdate
    ) -> Client:
        client = await self.get(client_id, org_id)
        if not client:
            raise ValueError("Client not found")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(client, key, value)

        await self.session.commit()
        await self.session.refresh(client)
        return client

    async def add_sub_client(
        self, parent_id: uuid.UUID, org_id: uuid.UUID, data: ClientCreate
    ) -> Client:
        data.parent_id = parent_id
        return await self.create(org_id, data)

    async def get_aggregate_report(
        self, client_id: uuid.UUID, org_id: uuid.UUID
    ) -> dict:
        client = await self.get(client_id, org_id)
        if not client:
            raise ValueError("Client not found")

        # Count work orders and sum revenue for the client
        result = await self.session.execute(
            select(
                func.count(WorkOrder.id).label("project_count"),
                func.coalesce(func.sum(WorkOrder.job_value), 0).label("revenue"),
            ).where(
                WorkOrder.client_id == client_id,
                WorkOrder.organization_id == org_id,
            )
        )
        row = result.one()
        total_projects = row.project_count
        total_revenue = row.revenue

        # Get sub-client IDs directly from DB to avoid stale relationship cache
        sub_ids_result = await self.session.execute(
            select(Client.id).where(
                Client.parent_id == client_id,
                Client.organization_id == org_id,
            )
        )
        sub_client_ids = list(sub_ids_result.scalars().all())
        sub_client_projects = 0
        sub_client_revenue = 0

        if sub_client_ids:
            sub_result = await self.session.execute(
                select(
                    func.count(WorkOrder.id).label("project_count"),
                    func.coalesce(func.sum(WorkOrder.job_value), 0).label("revenue"),
                ).where(
                    WorkOrder.client_id.in_(sub_client_ids),
                    WorkOrder.organization_id == org_id,
                )
            )
            sub_row = sub_result.one()
            sub_client_projects = sub_row.project_count
            sub_client_revenue = sub_row.revenue

        return {
            "client_id": client.id,
            "client_name": client.name,
            "total_projects": total_projects,
            "total_revenue": total_revenue,
            "sub_client_count": len(sub_client_ids),
            "sub_client_projects": sub_client_projects,
            "sub_client_revenue": sub_client_revenue,
            "combined_projects": total_projects + sub_client_projects,
            "combined_revenue": total_revenue + sub_client_revenue,
        }
