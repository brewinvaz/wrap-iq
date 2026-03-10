import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Text, Uuid
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
        Enum(WrapCoverage, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    roof_coverage: Mapped[CoverageLevel | None] = mapped_column(
        Enum(
            CoverageLevel,
            name="roof_coverage_level",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=True,
    )
    door_handles: Mapped[CoverageLevel | None] = mapped_column(
        Enum(
            CoverageLevel,
            name="door_handle_coverage",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=True,
    )
    window_coverage: Mapped[WindowCoverage | None] = mapped_column(
        Enum(WindowCoverage, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    bumper_coverage: Mapped[BumperCoverage | None] = mapped_column(
        Enum(BumperCoverage, values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    misc_items: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    special_wrap_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
