"""Rate limiting middleware using slowapi with Redis backend."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import settings


def get_real_ip(request: Request) -> str:
    """Extract the real client IP, respecting reverse-proxy headers.

    Resolution order:
    1. Authenticated user ID from request state (if available).
    2. First IP in ``X-Forwarded-For`` header (set by reverse proxies).
    3. Direct connection IP via ``get_remote_address`` (fallback).
    """
    # Prefer user identity for authenticated endpoints so per-user limits
    # work correctly even when many users share a proxy IP.
    user = getattr(request.state, "user", None)
    if user is not None:
        user_id = getattr(user, "id", None)
        if user_id is not None:
            return f"user:{user_id}"

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # The leftmost IP is the original client; proxies append to the right.
        client_ip = forwarded_for.split(",")[0].strip()
        if client_ip:
            return client_ip

    return get_remote_address(request)


# Use Redis for distributed rate limiting across workers.
limiter = Limiter(
    key_func=get_real_ip,
    storage_uri=settings.redis_url,
    headers_enabled=True,
)
