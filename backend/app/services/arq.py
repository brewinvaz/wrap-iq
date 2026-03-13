import asyncio
import logging

from arq.connections import ArqRedis, RedisSettings, create_pool

from app.config import settings

logger = logging.getLogger("wrapiq")

_arq_pool: ArqRedis | None = None
_arq_lock = asyncio.Lock()


async def get_arq_pool() -> ArqRedis:
    """Get or create the ARQ Redis connection pool.

    Safe within a single-threaded asyncio event loop.
    """
    global _arq_pool
    if _arq_pool is None:
        async with _arq_lock:
            if _arq_pool is None:
                _arq_pool = await create_pool(
                    RedisSettings.from_dsn(settings.redis_url)
                )
                logger.info("ARQ pool created")
    return _arq_pool


async def close_arq_pool() -> None:
    """Close the ARQ pool. Called during FastAPI lifespan shutdown."""
    global _arq_pool
    if _arq_pool is not None:
        await _arq_pool.aclose()
        _arq_pool = None
        logger.info("ARQ pool closed")
