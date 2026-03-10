import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token
from app.auth.passwords import hash_password
from app.models.audit_log import ActionType
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.user import Role, User
from app.models.work_order import WorkOrder
from app.services.audit_log import AuditLogService


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug + "-" + uuid.uuid4().hex[:6]


class SuperadminService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.audit = AuditLogService(session)

    # ── Org management ───────────────────────────────────────────────

    async def list_orgs(
        self,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Organization], int]:
        query = select(Organization)
        count_query = select(func.count()).select_from(Organization)

        if search:
            query = query.where(Organization.name.ilike(f"%{search}%"))
            count_query = count_query.where(Organization.name.ilike(f"%{search}%"))

        query = query.order_by(Organization.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        orgs = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()

        return orgs, total

    async def get_org_detail(self, org_id: uuid.UUID) -> dict | None:
        result = await self.session.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            return None

        user_count_result = await self.session.execute(
            select(func.count()).select_from(User).where(User.organization_id == org_id)
        )
        user_count = user_count_result.scalar_one()

        wo_count_result = await self.session.execute(
            select(func.count())
            .select_from(WorkOrder)
            .where(WorkOrder.organization_id == org_id)
        )
        work_order_count = wo_count_result.scalar_one()

        return {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "plan_id": org.plan_id,
            "is_active": org.is_active,
            "created_at": org.created_at,
            "updated_at": org.updated_at,
            "user_count": user_count,
            "work_order_count": work_order_count,
        }

    async def create_org(
        self,
        name: str,
        plan_id: uuid.UUID,
        is_active: bool,
        superadmin_id: uuid.UUID,
    ) -> Organization:
        org = Organization(
            id=uuid.uuid4(),
            name=name,
            slug=_slugify(name),
            plan_id=plan_id,
            is_active=is_active,
        )
        self.session.add(org)
        await self.session.flush()

        await self.audit.create_log(
            organization_id=org.id,
            action=ActionType.SUPERADMIN_ACTION,
            resource_type="organization",
            resource_id=org.id,
            user_id=superadmin_id,
            details={"action": "org_created", "name": name},
        )
        return org

    async def update_org(
        self,
        org_id: uuid.UUID,
        superadmin_id: uuid.UUID,
        name: str | None = None,
        plan_id: uuid.UUID | None = None,
        is_active: bool | None = None,
    ) -> Organization | None:
        result = await self.session.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            return None

        changes = {}
        if name is not None:
            org.name = name
            changes["name"] = name
        if plan_id is not None:
            org.plan_id = plan_id
            changes["plan_id"] = str(plan_id)
        if is_active is not None:
            org.is_active = is_active
            changes["is_active"] = is_active

        await self.audit.create_log(
            organization_id=org.id,
            action=ActionType.SUPERADMIN_ACTION,
            resource_type="organization",
            resource_id=org.id,
            user_id=superadmin_id,
            details={"action": "org_updated", "changes": changes},
        )
        await self.session.flush()
        return org

    # ── User management ──────────────────────────────────────────────

    async def list_users(
        self,
        organization_id: uuid.UUID | None = None,
        role: Role | None = None,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        query = select(User)
        count_query = select(func.count()).select_from(User)

        if organization_id is not None:
            query = query.where(User.organization_id == organization_id)
            count_query = count_query.where(User.organization_id == organization_id)

        if role is not None:
            query = query.where(User.role == role)
            count_query = count_query.where(User.role == role)

        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)

        query = query.order_by(User.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        users = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar_one()

        return users, total

    async def get_user(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def update_user(
        self,
        user_id: uuid.UUID,
        superadmin_id: uuid.UUID,
        role: Role | None = None,
        is_active: bool | None = None,
        is_superadmin: bool | None = None,
    ) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return None

        changes = {}
        if role is not None:
            user.role = role
            changes["role"] = role.value
        if is_active is not None:
            user.is_active = is_active
            changes["is_active"] = is_active
        if is_superadmin is not None:
            user.is_superadmin = is_superadmin
            changes["is_superadmin"] = is_superadmin

        # Only log audit if user belongs to an org (FK constraint)
        if user.organization_id is not None:
            await self.audit.create_log(
                organization_id=user.organization_id,
                action=ActionType.SUPERADMIN_ACTION,
                resource_type="user",
                resource_id=user.id,
                user_id=superadmin_id,
                details={"action": "user_updated", "changes": changes},
            )
        await self.session.flush()
        return user

    async def create_superadmin_user(
        self,
        email: str,
        password: str,
        superadmin_id: uuid.UUID,
        is_superadmin: bool = True,
    ) -> User:
        # Check for existing email
        result = await self.session.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            raise ValueError("Email already registered")

        user = User(
            id=uuid.uuid4(),
            organization_id=None,
            email=email,
            password_hash=hash_password(password),
            role=Role.ADMIN,
            is_superadmin=is_superadmin,
        )
        self.session.add(user)
        await self.session.flush()

        # Skip audit log for org-less superadmin users (FK constraint)
        return user

    # ── Metrics ──────────────────────────────────────────────────────

    async def get_metrics(self) -> dict:
        total_orgs = (
            await self.session.execute(select(func.count()).select_from(Organization))
        ).scalar_one()

        total_users = (
            await self.session.execute(select(func.count()).select_from(User))
        ).scalar_one()

        total_work_orders = (
            await self.session.execute(select(func.count()).select_from(WorkOrder))
        ).scalar_one()

        # Orgs grouped by plan
        orgs_by_plan_query = (
            select(Plan.name, func.count(Organization.id))
            .join(Organization, Organization.plan_id == Plan.id)
            .group_by(Plan.name)
        )
        orgs_by_plan_result = await self.session.execute(orgs_by_plan_query)
        orgs_by_plan = [
            {"plan_name": row[0], "count": row[1]} for row in orgs_by_plan_result.all()
        ]

        # Recent signups (last 10 orgs)
        recent_query = (
            select(Organization.name, Organization.created_at)
            .order_by(Organization.created_at.desc())
            .limit(10)
        )
        recent_result = await self.session.execute(recent_query)
        recent_signups = [
            {"org_name": row[0], "created_at": row[1]} for row in recent_result.all()
        ]

        return {
            "total_organizations": total_orgs,
            "total_users": total_users,
            "total_work_orders": total_work_orders,
            "orgs_by_plan": orgs_by_plan,
            "recent_signups": recent_signups,
        }

    # ── Impersonation ────────────────────────────────────────────────

    async def start_impersonation(
        self,
        superadmin: User,
        org_id: uuid.UUID,
    ) -> dict | None:
        result = await self.session.execute(
            select(Organization).where(
                Organization.id == org_id,
                Organization.is_active.is_(True),
            )
        )
        org = result.scalar_one_or_none()
        if not org:
            return None

        token = create_access_token(
            user_id=superadmin.id,
            organization_id=org.id,
            role="admin",
            is_superadmin=True,
            impersonating=True,
            real_user_id=superadmin.id,
            expire_minutes=60,
        )

        await self.audit.create_log(
            organization_id=org.id,
            action=ActionType.IMPERSONATION_STARTED,
            resource_type="organization",
            resource_id=org.id,
            user_id=superadmin.id,
            details={"real_user_id": str(superadmin.id)},
        )
        await self.session.flush()

        return {
            "access_token": token,
            "organization_id": org.id,
            "impersonating": True,
        }

    async def stop_impersonation(self, superadmin: User) -> dict:
        token = create_access_token(
            user_id=superadmin.id,
            organization_id=None,
            role="admin",
            is_superadmin=True,
            impersonating=False,
        )

        # Skip audit log for stop-impersonation (no valid org FK)

        return {
            "access_token": token,
            "impersonating": False,
        }
