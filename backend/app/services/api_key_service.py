import hashlib
import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import APIKey, APIKeyUsageLog


class APIKeyService:
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def _generate_raw_key() -> str:
        return f"wiq_{secrets.token_urlsafe(32)}"

    @staticmethod
    def _hash_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode()).hexdigest()

    async def generate_api_key(
        self,
        organization_id: uuid.UUID,
        created_by: uuid.UUID,
        name: str,
        scopes: list[str],
        rate_limit_per_minute: int = 60,
        rate_limit_per_day: int = 10000,
        expires_at: datetime | None = None,
    ) -> tuple[APIKey, str]:
        raw_key = self._generate_raw_key()
        key_hash = self._hash_key(raw_key)
        key_prefix = raw_key[:8]

        api_key = APIKey(
            id=uuid.uuid4(),
            organization_id=organization_id,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            scopes=scopes,
            rate_limit_per_minute=rate_limit_per_minute,
            rate_limit_per_day=rate_limit_per_day,
            created_by=created_by,
            expires_at=expires_at,
        )
        self.session.add(api_key)
        await self.session.commit()
        await self.session.refresh(api_key)
        return api_key, raw_key

    async def list_api_keys(
        self,
        organization_id: uuid.UUID,
    ) -> tuple[list[APIKey], int]:
        query = (
            select(APIKey)
            .where(APIKey.organization_id == organization_id)
            .order_by(APIKey.created_at.desc())
        )
        count_query = (
            select(func.count())
            .select_from(APIKey)
            .where(APIKey.organization_id == organization_id)
        )

        result = await self.session.execute(query)
        keys = list(result.scalars().all())

        count_result = await self.session.execute(count_query)
        total = count_result.scalar()

        return keys, total

    async def get_api_key(
        self, key_id: uuid.UUID, organization_id: uuid.UUID
    ) -> APIKey | None:
        result = await self.session.execute(
            select(APIKey).where(
                APIKey.id == key_id,
                APIKey.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def revoke_api_key(
        self, key_id: uuid.UUID, organization_id: uuid.UUID
    ) -> APIKey | None:
        api_key = await self.get_api_key(key_id, organization_id)
        if not api_key:
            return None

        api_key.is_active = False
        api_key.revoked_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(api_key)
        return api_key

    async def rotate_api_key(
        self, key_id: uuid.UUID, organization_id: uuid.UUID
    ) -> tuple[APIKey, str] | None:
        old_key = await self.get_api_key(key_id, organization_id)
        if not old_key:
            return None

        # Revoke the old key
        old_key.is_active = False
        old_key.revoked_at = datetime.now(UTC)

        # Generate a new key with the same scopes and limits
        new_key, raw_key = await self.generate_api_key(
            organization_id=organization_id,
            created_by=old_key.created_by,
            name=old_key.name,
            scopes=old_key.scopes,
            rate_limit_per_minute=old_key.rate_limit_per_minute,
            rate_limit_per_day=old_key.rate_limit_per_day,
            expires_at=old_key.expires_at,
        )
        return new_key, raw_key

    async def get_usage_stats(self, key_id: uuid.UUID) -> dict:
        # Total requests
        total_result = await self.session.execute(
            select(func.count())
            .select_from(APIKeyUsageLog)
            .where(APIKeyUsageLog.api_key_id == key_id)
        )
        total_requests = total_result.scalar() or 0

        # Requests today
        today_start = datetime.now(UTC).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        today_result = await self.session.execute(
            select(func.count())
            .select_from(APIKeyUsageLog)
            .where(
                APIKeyUsageLog.api_key_id == key_id,
                APIKeyUsageLog.timestamp >= today_start,
            )
        )
        requests_today = today_result.scalar() or 0

        # Avg response time
        avg_result = await self.session.execute(
            select(func.avg(APIKeyUsageLog.response_time_ms)).where(
                APIKeyUsageLog.api_key_id == key_id
            )
        )
        avg_response_time = avg_result.scalar() or 0.0

        # Top endpoints
        top_result = await self.session.execute(
            select(
                APIKeyUsageLog.endpoint,
                func.count().label("count"),
            )
            .where(APIKeyUsageLog.api_key_id == key_id)
            .group_by(APIKeyUsageLog.endpoint)
            .order_by(func.count().desc())
            .limit(5)
        )
        top_endpoints = [
            {"endpoint": row.endpoint, "count": row.count} for row in top_result.all()
        ]

        return {
            "total_requests": total_requests,
            "requests_today": requests_today,
            "avg_response_time": round(float(avg_response_time), 2),
            "top_endpoints": top_endpoints,
        }

    async def get_usage_count(self, key_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(APIKeyUsageLog)
            .where(APIKeyUsageLog.api_key_id == key_id)
        )
        return result.scalar() or 0

    async def validate_api_key(self, raw_key: str) -> APIKey | None:
        key_hash = self._hash_key(raw_key)
        result = await self.session.execute(
            select(APIKey).where(
                APIKey.key_hash == key_hash,
                APIKey.is_active.is_(True),
            )
        )
        api_key = result.scalar_one_or_none()
        if not api_key:
            return None

        # Check expiry
        if api_key.expires_at and api_key.expires_at < datetime.now(UTC):
            return None

        # Update last_used_at
        api_key.last_used_at = datetime.now(UTC)
        await self.session.commit()
        return api_key
