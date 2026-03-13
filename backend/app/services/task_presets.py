import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_preset import TaskPreset
from app.models.time_log import Phase

DEFAULT_PRESETS: dict[Phase, list[str]] = {
    Phase.DESIGN: [
        "Concept & Mockup",
        "Client Revision",
        "Final Proof",
        "File Prep",
        "Template Creation",
    ],
    Phase.PRODUCTION: [
        "Print",
        "Laminate",
        "Cut & Weed",
        "Quality Check",
        "Material Prep",
    ],
    Phase.INSTALL: [
        "Surface Prep",
        "Application",
        "Post-Heat",
        "Trim & Finishing",
        "Quality Inspection",
    ],
    Phase.OTHER: [
        "Admin",
        "Client Meeting",
        "Training",
        "Shop Maintenance",
    ],
}


class TaskPresetService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def seed_defaults(self, organization_id: uuid.UUID) -> list[TaskPreset]:
        """Create default task presets for an organization."""
        presets = []
        for phase, names in DEFAULT_PRESETS.items():
            for i, name in enumerate(names):
                preset = TaskPreset(
                    id=uuid.uuid4(),
                    organization_id=organization_id,
                    phase=phase,
                    name=name,
                    sort_order=i,
                )
                self.session.add(preset)
                presets.append(preset)
        await self.session.commit()
        for preset in presets:
            await self.session.refresh(preset)
        return presets

    async def list_presets(
        self,
        organization_id: uuid.UUID,
        phase: str | None = None,
        include_inactive: bool = False,
    ) -> tuple[list[TaskPreset], int]:
        """List task presets, seeding defaults if none exist for the org."""
        # Check if any presets exist for this org
        count_result = await self.session.execute(
            select(func.count())
            .select_from(TaskPreset)
            .where(TaskPreset.organization_id == organization_id)
        )
        if count_result.scalar() == 0:
            await self.seed_defaults(organization_id)

        # Build query
        query = select(TaskPreset).where(
            TaskPreset.organization_id == organization_id
        )
        count_query = (
            select(func.count())
            .select_from(TaskPreset)
            .where(TaskPreset.organization_id == organization_id)
        )

        if phase:
            query = query.where(TaskPreset.phase == phase)
            count_query = count_query.where(TaskPreset.phase == phase)

        if not include_inactive:
            query = query.where(TaskPreset.is_active.is_(True))
            count_query = count_query.where(TaskPreset.is_active.is_(True))

        query = query.order_by(TaskPreset.phase, TaskPreset.sort_order)

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        return items, total

    async def get_by_id(
        self, preset_id: uuid.UUID, organization_id: uuid.UUID
    ) -> TaskPreset | None:
        result = await self.session.execute(
            select(TaskPreset).where(
                TaskPreset.id == preset_id,
                TaskPreset.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()
