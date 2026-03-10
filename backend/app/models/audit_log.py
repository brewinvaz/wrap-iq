import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TenantMixin, TimestampMixin


class ActionType(enum.StrEnum):
    # Project/Work Order actions
    PROJECT_CREATED = "project_created"
    PROJECT_UPDATED = "project_updated"
    PROJECT_DELETED = "project_deleted"
    STATUS_CHANGED = "status_changed"

    # User management actions
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DEACTIVATED = "user_deactivated"

    # Organization/billing actions
    ORG_UPDATED = "org_updated"
    BILLING_UPDATED = "billing_updated"

    # System events
    SYSTEM_EVENT = "system_event"

    # Superadmin actions
    IMPERSONATION_STARTED = "impersonation_started"
    IMPERSONATION_STOPPED = "impersonation_stopped"
    SUPERADMIN_ACTION = "superadmin_action"


class AuditLog(Base, TenantMixin, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True, nullable=True
    )
    action: Mapped[ActionType] = mapped_column(Enum(ActionType), index=True)
    resource_type: Mapped[str] = mapped_column(String(100), index=True)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    user = relationship("User", lazy="selectin")
