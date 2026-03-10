"""Rate limiting middleware using slowapi with Redis backend."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Use Redis for distributed rate limiting across workers.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    headers_enabled=True,
    default_limits=["120/minute"],
)
