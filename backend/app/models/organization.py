import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("plans.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    plan = relationship("Plan", lazy="selectin")
    users = relationship("User", back_populates="organization", lazy="selectin")
