import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin


class InstallLocation(enum.StrEnum):
    IN_SHOP = "in_shop"
    ON_SITE = "on_site"


class InstallDifficulty(enum.StrEnum):
    EASY = "easy"
    STANDARD = "standard"
    COMPLEX = "complex"


class LogType(enum.StrEnum):
    DEMO_REMOVAL = "demo_removal"
    PREP = "prep"
    INSTALL = "install"


class InstallDetails(Base, TimestampMixin):
    __tablename__ = "install_details"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    work_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("work_orders.id"), unique=True, index=True
    )
    install_location: Mapped[InstallLocation | None] = mapped_column(
        Enum(InstallLocation), nullable=True
    )
    install_difficulty: Mapped[InstallDifficulty | None] = mapped_column(
        Enum(InstallDifficulty), nullable=True
    )
    install_start_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    install_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    work_order = relationship("WorkOrder", back_populates="install_details")
    time_logs = relationship(
        "InstallTimeLog", back_populates="install_details", lazy="selectin"
    )


class InstallTimeLog(Base, TimestampMixin):
    __tablename__ = "install_time_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    install_details_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("install_details.id"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)
    log_type: Mapped[LogType] = mapped_column(Enum(LogType))
    hours: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    install_details = relationship("InstallDetails", back_populates="time_logs")
    user = relationship("User", lazy="selectin")
