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
            raise ValueError(
                "Equipment is assigned to work orders and cannot be deleted"
            )
        await self.session.delete(equipment)
        await self.session.commit()

    async def get_stats(self, org_id: uuid.UUID) -> EquipmentStats:
        base = Equipment.organization_id == org_id
        total_q = select(func.count(Equipment.id)).where(base)
        active_q = select(func.count(Equipment.id)).where(
            base, Equipment.is_active.is_(True)
        )
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
        return EquipmentStats(
            total=total, active=active, printers=printers, other=other
        )
