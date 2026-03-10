import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import create_access_token, create_refresh_token
from app.auth.passwords import hash_password, verify_password
from app.models.magic_link import MagicLink
from app.models.organization import Organization
from app.models.plan import Plan
from app.models.refresh_token import RefreshToken
from app.models.user import Role, User


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return slug


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def register(
        self, email: str, password: str, org_name: str
    ) -> dict[str, str]:
        existing = await self.session.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")

        plan = await self.session.execute(select(Plan).where(Plan.is_default.is_(True)))
        plan = plan.scalar_one()

        org = Organization(
            id=uuid.uuid4(),
            name=org_name,
            slug=_slugify(org_name) + "-" + uuid.uuid4().hex[:6],
            plan_id=plan.id,
        )
        self.session.add(org)
        await self.session.flush()

        user = User(
            id=uuid.uuid4(),
            organization_id=org.id,
            email=email,
            password_hash=hash_password(password),
            role=Role.ADMIN,
        )
        self.session.add(user)
        await self.session.flush()

        tokens = await self._create_tokens(user)
        await self.session.commit()
        return tokens

    async def login(self, email: str, password: str) -> dict[str, str]:
        result = await self.session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not user.password_hash:
            raise ValueError("Invalid email or password")
        if not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")

        tokens = await self._create_tokens(user)
        await self.session.commit()
        return tokens

    async def request_magic_link(self, email: str) -> str | None:
        result = await self.session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            return None

        token = secrets.token_urlsafe(32)
        link = MagicLink(
            id=uuid.uuid4(),
            user_id=user.id,
            token=token,
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
        )
        self.session.add(link)
        await self.session.commit()
        return token

    async def verify_magic_link(self, token: str) -> dict[str, str]:
        result = await self.session.execute(
            select(MagicLink).where(
                MagicLink.token == token,
                MagicLink.used_at.is_(None),
                MagicLink.expires_at > datetime.now(UTC),
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            raise ValueError("Invalid or expired magic link")

        link.used_at = datetime.now(UTC)

        result = await self.session.execute(select(User).where(User.id == link.user_id))
        user = result.scalar_one()

        tokens = await self._create_tokens(user)
        await self.session.commit()
        return tokens

    async def refresh(self, refresh_token_str: str) -> dict[str, str]:
        result = await self.session.execute(
            select(RefreshToken).where(
                RefreshToken.token == refresh_token_str,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(UTC),
            )
        )
        token_record = result.scalar_one_or_none()
        if not token_record:
            raise ValueError("Invalid or expired refresh token")

        # Revoke the old refresh token
        token_record.revoked_at = datetime.now(UTC)

        result = await self.session.execute(
            select(User).where(User.id == token_record.user_id)
        )
        user = result.scalar_one()

        tokens = await self._create_tokens(user)
        await self.session.commit()
        return tokens

    async def logout(self, refresh_token_str: str) -> None:
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.token == refresh_token_str)
        )
        token_record = result.scalar_one_or_none()
        if token_record:
            token_record.revoked_at = datetime.now(UTC)
            await self.session.commit()

    async def _create_tokens(self, user: User) -> dict[str, str]:
        access_token = create_access_token(
            user_id=user.id,
            organization_id=user.organization_id,
            role=user.role.value,
            is_superadmin=user.is_superadmin,
        )
        refresh_token_str = create_refresh_token(user_id=user.id)

        refresh_record = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token=refresh_token_str,
            expires_at=datetime.now(UTC) + timedelta(days=30),
        )
        self.session.add(refresh_record)
        return {"access_token": access_token, "refresh_token": refresh_token_str}
