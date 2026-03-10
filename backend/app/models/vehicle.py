import enum
import uuid

import sqlalchemy as sa
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
    __table_args__ = (
        sa.Index(
            "ix_vehicle_org_vin",
            "organization_id",
            "vin",
            unique=True,
            postgresql_where=sa.text("vin IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    vin: Mapped[str | None] = mapped_column(String(17), nullable=True, index=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    make: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vehicle_unit_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    vehicle_type: Mapped[VehicleType | None] = mapped_column(
        Enum(VehicleType, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    truck_cab_size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    truck_bed_length: Mapped[str | None] = mapped_column(String(50), nullable=True)
    van_roof_height: Mapped[str | None] = mapped_column(String(50), nullable=True)
    van_wheelbase: Mapped[str | None] = mapped_column(String(50), nullable=True)
    van_length: Mapped[str | None] = mapped_column(String(50), nullable=True)
