import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings


def create_access_token(
    user_id: uuid.UUID,
    organization_id: uuid.UUID | None = None,
    role: str = "admin",
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "org": str(organization_id) if organization_id else None,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(days=settings.refresh_token_expire_days),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
