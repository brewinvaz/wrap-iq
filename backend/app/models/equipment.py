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
