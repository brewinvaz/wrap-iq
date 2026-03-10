import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan import Plan
from app.models.subscription import (
    PaymentMethod,
    Subscription,
    SubscriptionStatus,
)
from app.models.user import User
from app.models.work_order import WorkOrder


class SubscriptionService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # --- Plans ---

    async def get_plans(self) -> list[Plan]:
        result = await self.session.execute(
            select(Plan).order_by(Plan.price_cents.asc())
        )
        return list(result.scalars().all())

    # --- Subscription ---

    async def get_subscription(self, org_id: uuid.UUID) -> Subscription | None:
        result = await self.session.execute(
            select(Subscription).where(Subscription.organization_id == org_id)
        )
        return result.scalar_one_or_none()

    async def create_subscription(
        self, org_id: uuid.UUID, plan_id: uuid.UUID
    ) -> Subscription:
        now = datetime.now(UTC)
        subscription = Subscription(
            id=uuid.uuid4(),
            organization_id=org_id,
            plan_id=plan_id,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
        self.session.add(subscription)
        await self.session.commit()
        await self.session.refresh(subscription)
        return subscription

    async def update_subscription(
        self, org_id: uuid.UUID, plan_id: uuid.UUID
    ) -> Subscription | None:
        subscription = await self.get_subscription(org_id)
        if not subscription:
            return None
        subscription.plan_id = plan_id
        await self.session.commit()
        await self.session.refresh(subscription)
        return subscription

    async def cancel_subscription(self, org_id: uuid.UUID) -> Subscription | None:
        subscription = await self.get_subscription(org_id)
        if not subscription:
            return None
        subscription.cancel_at_period_end = True
        subscription.status = SubscriptionStatus.CANCELED
        await self.session.commit()
        await self.session.refresh(subscription)
        return subscription

    # --- Payment Methods ---

    async def list_payment_methods(self, org_id: uuid.UUID) -> list[PaymentMethod]:
        result = await self.session.execute(
            select(PaymentMethod).where(PaymentMethod.organization_id == org_id)
        )
        return list(result.scalars().all())

    async def add_payment_method(self, org_id: uuid.UUID, data: dict) -> PaymentMethod:
        pm = PaymentMethod(
            id=uuid.uuid4(),
            organization_id=org_id,
            **data,
        )
        # If setting as default, unset others
        if pm.is_default:
            await self._clear_default_payment_methods(org_id)
        self.session.add(pm)
        await self.session.commit()
        await self.session.refresh(pm)
        return pm

    async def remove_payment_method(self, pm_id: uuid.UUID, org_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(PaymentMethod).where(
                PaymentMethod.id == pm_id,
                PaymentMethod.organization_id == org_id,
            )
        )
        pm = result.scalar_one_or_none()
        if not pm:
            return False
        await self.session.delete(pm)
        await self.session.commit()
        return True

    async def set_default_payment_method(
        self, pm_id: uuid.UUID, org_id: uuid.UUID
    ) -> PaymentMethod | None:
        result = await self.session.execute(
            select(PaymentMethod).where(
                PaymentMethod.id == pm_id,
                PaymentMethod.organization_id == org_id,
            )
        )
        pm = result.scalar_one_or_none()
        if not pm:
            return None
        await self._clear_default_payment_methods(org_id)
        pm.is_default = True
        await self.session.commit()
        await self.session.refresh(pm)
        return pm

    async def _clear_default_payment_methods(self, org_id: uuid.UUID) -> None:
        result = await self.session.execute(
            select(PaymentMethod).where(
                PaymentMethod.organization_id == org_id,
                PaymentMethod.is_default.is_(True),
            )
        )
        for pm in result.scalars().all():
            pm.is_default = False
        await self.session.flush()

    # --- Usage Metrics ---

    async def get_usage_metrics(self, org_id: uuid.UUID) -> dict:
        # Seats used = active users in org
        seats_result = await self.session.execute(
            select(func.count(User.id)).where(
                User.organization_id == org_id,
                User.is_active.is_(True),
            )
        )
        seats_used = seats_result.scalar() or 0

        # Projects count
        projects_result = await self.session.execute(
            select(func.count(WorkOrder.id)).where(WorkOrder.organization_id == org_id)
        )
        projects_count = projects_result.scalar() or 0

        # Get plan limits from subscription
        subscription = await self.get_subscription(org_id)
        seats_limit = 5  # default
        storage_limit_gb = 1.0  # default

        if subscription and subscription.plan:
            features = subscription.plan.features or {}
            seats_limit = features.get("max_seats", 5)
            storage_limit_gb = features.get("max_storage_gb", 1.0)

        return {
            "seats_used": seats_used,
            "seats_limit": seats_limit,
            "storage_used_gb": round(seats_used * 0.1, 2),  # placeholder
            "storage_limit_gb": storage_limit_gb,
            "projects_count": projects_count,
        }
