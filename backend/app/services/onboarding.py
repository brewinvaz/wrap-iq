import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_invite import ClientInvite
from app.models.file_upload import FileUpload
from app.models.kanban_stage import KanbanStage, SystemStatus
from app.models.organization import Organization
from app.models.user import Role, User
from app.models.user_profile import UserProfile
from app.models.vehicle import Vehicle
from app.models.work_order import JobType, Priority, WorkOrder, WorkOrderVehicle
from app.services.r2 import validate_file_keys


class OnboardingService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Admin: invite management ─────────────────────────────────────

    async def create_invite(
        self,
        organization_id: uuid.UUID,
        email: str,
        invited_by: uuid.UUID,
    ) -> ClientInvite:
        invite = ClientInvite(
            id=uuid.uuid4(),
            organization_id=organization_id,
            email=email,
            token=secrets.token_urlsafe(32),
            invited_by=invited_by,
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
        self.session.add(invite)
        await self.session.flush()
        return invite

    async def list_invites(
        self,
        organization_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ClientInvite], int]:
        query = (
            select(ClientInvite)
            .where(ClientInvite.organization_id == organization_id)
            .order_by(ClientInvite.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        count_query = (
            select(func.count())
            .select_from(ClientInvite)
            .where(ClientInvite.organization_id == organization_id)
        )
        result = await self.session.execute(query)
        invites = list(result.scalars().all())
        total = (await self.session.execute(count_query)).scalar_one()
        return invites, total

    # ── Client: token validation ─────────────────────────────────────

    async def validate_token(self, token: str) -> ClientInvite | None:
        """Return invite if token is valid, unexpired, and unused."""
        result = await self.session.execute(
            select(ClientInvite).where(
                ClientInvite.token == token,
                ClientInvite.accepted_at.is_(None),
                ClientInvite.expires_at > datetime.now(UTC),
            )
        )
        return result.scalar_one_or_none()

    async def get_org_for_invite(self, invite: ClientInvite) -> Organization:
        result = await self.session.execute(
            select(Organization).where(Organization.id == invite.organization_id)
        )
        return result.scalar_one()

    # ── Client: form submission ──────────────────────────────────────

    async def submit_onboarding(
        self,
        invite: ClientInvite,
        first_name: str,
        last_name: str,
        phone: str | None,
        company_name: str | None,
        address: str | None,
        vehicle_data: dict,
        job_type: JobType,
        project_description: str | None,
        referral_source: str | None,
        file_keys: list[dict],
    ) -> dict:
        org_id = invite.organization_id

        # Validate file keys
        if file_keys:
            validate_file_keys(org_id, file_keys)

        # 1. Find or create client User
        result = await self.session.execute(
            select(User).where(
                User.email == invite.email,
                User.organization_id == org_id,
            )
        )
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                id=uuid.uuid4(),
                organization_id=org_id,
                email=invite.email,
                password_hash=None,
                role=Role.CLIENT,
            )
            self.session.add(user)
            await self.session.flush()

        # 2. Create or update UserProfile
        result = await self.session.execute(
            select(UserProfile).where(UserProfile.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = UserProfile(
                id=uuid.uuid4(),
                user_id=user.id,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                company_name=company_name,
                address=address,
            )
            self.session.add(profile)
        else:
            profile.first_name = first_name
            profile.last_name = last_name
            profile.phone = phone
            profile.company_name = company_name
            profile.address = address
        await self.session.flush()

        # 3. Create Vehicle
        vehicle = Vehicle(
            id=uuid.uuid4(),
            organization_id=org_id,
            vin=vehicle_data.get("vin"),
            year=vehicle_data.get("year"),
            make=vehicle_data.get("make"),
            model=vehicle_data.get("model"),
            vehicle_type=vehicle_data.get("vehicle_type"),
        )
        self.session.add(vehicle)
        await self.session.flush()

        # 4. Find LEAD kanban stage for the org
        lead_stage = await self._get_lead_stage(org_id)

        # 5. Generate job number
        job_number = await self._generate_job_number(org_id)

        # 6. Create WorkOrder
        notes_parts = []
        if project_description:
            notes_parts.append(f"Project: {project_description}")
        if referral_source:
            notes_parts.append(f"Referral: {referral_source}")

        work_order = WorkOrder(
            id=uuid.uuid4(),
            organization_id=org_id,
            job_number=job_number,
            job_type=job_type,
            status_id=lead_stage.id,
            priority=Priority.medium,
            date_in=datetime.now(UTC),
            internal_notes="\n".join(notes_parts) if notes_parts else None,
        )
        self.session.add(work_order)
        await self.session.flush()

        # 7. Link vehicle to work order
        wov = WorkOrderVehicle(
            work_order_id=work_order.id,
            vehicle_id=vehicle.id,
            organization_id=org_id,
        )
        self.session.add(wov)

        # 8. Create FileUpload records
        for fk in file_keys:
            upload = FileUpload(
                id=uuid.uuid4(),
                organization_id=org_id,
                uploaded_by=user.id,
                work_order_id=work_order.id,
                r2_key=fk["r2_key"],
                filename=fk["filename"],
                content_type=fk["content_type"],
                size_bytes=fk["size_bytes"],
            )
            self.session.add(upload)

        # 9. Mark invite as accepted
        invite.accepted_at = datetime.now(UTC)

        await self.session.flush()

        return {
            "work_order_id": work_order.id,
            "job_number": work_order.job_number,
            "user_id": user.id,
        }

    async def _get_lead_stage(self, org_id: uuid.UUID) -> KanbanStage:
        result = await self.session.execute(
            select(KanbanStage).where(
                KanbanStage.organization_id == org_id,
                KanbanStage.system_status == SystemStatus.LEAD,
                KanbanStage.is_active.is_(True),
            )
        )
        stage = result.scalar_one_or_none()
        if not stage:
            raise ValueError("No LEAD stage configured for this organization")
        return stage

    async def _generate_job_number(self, org_id: uuid.UUID) -> str:
        count_result = await self.session.execute(
            select(func.count())
            .select_from(WorkOrder)
            .where(WorkOrder.organization_id == org_id)
        )
        count = count_result.scalar_one()
        return f"WO-{count + 1:05d}"
