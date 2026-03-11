import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.work_order import WorkOrder

DEFAULT_STAGES: list[dict] = [
    {
        "name": "Lead",
        "color": "#64748b",
        "position": 0,
        "system_status": SystemStatus.LEAD,
    },
    {
        "name": "Scheduled",
        "color": "#2563eb",
        "position": 1,
        "system_status": SystemStatus.IN_PROGRESS,
    },
    {
        "name": "In Design",
        "color": "#7c3aed",
        "position": 2,
        "system_status": SystemStatus.IN_PROGRESS,
    },
    {
        "name": "In Production",
        "color": "#d97706",
        "position": 3,
        "system_status": SystemStatus.IN_PROGRESS,
    },
    {
        "name": "Ready to Install",
        "color": "#059669",
        "position": 4,
        "system_status": SystemStatus.IN_PROGRESS,
    },
    {
        "name": "Installing",
        "color": "#2563eb",
        "position": 5,
        "system_status": SystemStatus.IN_PROGRESS,
    },
    {
        "name": "Completed",
        "color": "#16a34a",
        "position": 6,
        "system_status": SystemStatus.COMPLETED,
    },
    {
        "name": "Cancelled",
        "color": "#e11d48",
        "position": 7,
        "system_status": SystemStatus.CANCELLED,
    },
]


class KanbanStageService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def seed_defaults(self, organization_id: uuid.UUID) -> list[KanbanStage]:
        """Create default stages for an organization."""
        stages = []
        for stage_data in DEFAULT_STAGES:
            stage = KanbanStage(
                id=uuid.uuid4(),
                organization_id=organization_id,
                is_default=True,
                **stage_data,
            )
            self.session.add(stage)
            stages.append(stage)
        await self.session.commit()
        for stage in stages:
            await self.session.refresh(stage)
        return stages

    async def list_stages(self, organization_id: uuid.UUID) -> list[KanbanStage]:
        """List active stages for an org, seeding defaults if none exist."""
        query = (
            select(KanbanStage)
            .where(
                KanbanStage.organization_id == organization_id,
                KanbanStage.is_active.is_(True),
            )
            .order_by(KanbanStage.position)
        )
        result = await self.session.execute(query)
        stages = list(result.scalars().all())

        if not stages:
            stages = await self.seed_defaults(organization_id)

        return stages

    async def create(
        self,
        organization_id: uuid.UUID,
        name: str,
        color: str = "#64748b",
        position: int = 0,
        system_status: SystemStatus | None = None,
        is_default: bool = False,
    ) -> KanbanStage:
        stage = KanbanStage(
            id=uuid.uuid4(),
            organization_id=organization_id,
            name=name,
            color=color,
            position=position,
            system_status=system_status,
            is_default=is_default,
        )
        self.session.add(stage)
        await self.session.commit()
        await self.session.refresh(stage)
        return stage

    async def get_by_id(
        self, stage_id: uuid.UUID, organization_id: uuid.UUID
    ) -> KanbanStage | None:
        result = await self.session.execute(
            select(KanbanStage).where(
                KanbanStage.id == stage_id,
                KanbanStage.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def update_stage(
        self,
        stage_id: uuid.UUID,
        organization_id: uuid.UUID,
        **kwargs,
    ) -> KanbanStage | None:
        stage = await self.get_by_id(stage_id, organization_id)
        if not stage:
            return None

        for key, value in kwargs.items():
            if value is not None:
                setattr(stage, key, value)

        await self.session.commit()
        await self.session.refresh(stage)
        return stage

    async def get_active_by_id(
        self, stage_id: uuid.UUID, organization_id: uuid.UUID
    ) -> KanbanStage | None:
        """Get a stage only if it is active."""
        result = await self.session.execute(
            select(KanbanStage).where(
                KanbanStage.id == stage_id,
                KanbanStage.organization_id == organization_id,
                KanbanStage.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def delete_stage(
        self, stage_id: uuid.UUID, organization_id: uuid.UUID
    ) -> KanbanStage | None:
        """Soft-delete a stage, reassigning its work orders to the
        first active stage. Cannot delete system-mapped stages."""
        stage = await self.get_by_id(stage_id, organization_id)
        if not stage:
            return None

        if stage.system_status is not None:
            return None

        # Count work orders in this stage
        count_result = await self.session.execute(
            select(func.count(WorkOrder.id)).where(WorkOrder.status_id == stage_id)
        )
        wo_count = count_result.scalar() or 0

        if wo_count > 0:
            # Find the first active stage to reassign to
            fallback_result = await self.session.execute(
                select(KanbanStage)
                .where(
                    KanbanStage.organization_id == organization_id,
                    KanbanStage.is_active.is_(True),
                    KanbanStage.id != stage_id,
                )
                .order_by(KanbanStage.position)
                .limit(1)
            )
            fallback = fallback_result.scalar_one_or_none()
            if not fallback:
                raise ValueError(
                    "Cannot delete: no other active stage to reassign work orders to"
                )

            # Reassign all work orders to the fallback stage
            await self.session.execute(
                update(WorkOrder)
                .where(WorkOrder.status_id == stage_id)
                .values(status_id=fallback.id)
            )

        stage.is_active = False
        await self.session.commit()
        await self.session.refresh(stage)
        return stage

    async def reorder(
        self,
        organization_id: uuid.UUID,
        items: list[dict],
    ) -> list[KanbanStage]:
        """Reorder stages by updating positions."""
        for item in items:
            await self.session.execute(
                update(KanbanStage)
                .where(
                    KanbanStage.id == item["id"],
                    KanbanStage.organization_id == organization_id,
                )
                .values(position=item["position"])
            )
        await self.session.commit()

        return await self.list_stages(organization_id)
