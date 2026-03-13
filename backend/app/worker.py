import logging
import uuid

import resend
from arq import func
from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.models.render import Render, RenderStatus
from app.services.r2 import delete_object, generate_object_key, upload_object
from app.services.renders import generate_image

logger = logging.getLogger("wrapiq")


async def startup(ctx: dict) -> None:
    engine = create_async_engine(
        settings.async_database_url,
        echo=settings.debug,
        pool_size=5,
        max_overflow=3,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=30,
    )
    ctx["engine"] = engine
    ctx["session_factory"] = async_sessionmaker(engine, expire_on_commit=False)
    logger.info("Worker started — DB pool ready")


async def shutdown(ctx: dict) -> None:
    engine = ctx.get("engine")
    if engine:
        await engine.dispose()
    logger.info("Worker stopped — DB pool disposed")


async def render_generate(
    ctx: dict,
    render_id: str,
    delete_old: bool = False,
) -> None:
    """Background task: generate a render image via Gemini API."""
    session_factory = ctx["session_factory"]
    rid = uuid.UUID(render_id)

    async with session_factory() as session:
        result = await session.execute(select(Render).where(Render.id == rid))
        render = result.scalar_one_or_none()
        if not render:
            logger.error("Render %s not found", render_id)
            return

        if render.status == RenderStatus.RENDERING:
            logger.warning("Render %s already rendering, skipping", render_id)
            return

        render.status = RenderStatus.RENDERING
        render.error_message = None
        await session.commit()

        try:
            result_bytes = await generate_image(
                render.vehicle_photo_key,
                render.wrap_design_key,
                render.description,
            )

            if delete_old and render.result_image_key:
                try:
                    delete_object(render.result_image_key)
                except Exception:
                    logger.warning(
                        "Failed to delete old result: %s", render.result_image_key
                    )

            result_key = generate_object_key(
                render.organization_id, "result.jpg", prefix="renders"
            )
            upload_object(result_key, result_bytes, "image/jpeg")

            render.result_image_key = result_key
            render.status = RenderStatus.COMPLETED
            logger.info("Render %s completed", render_id)
        except Exception as exc:
            logger.exception("Render %s failed", render_id)
            render.status = RenderStatus.FAILED
            render.error_message = str(exc)[:500]

        await session.commit()


async def send_email(
    ctx: dict,
    email_type: str,
    to_email: str,
    token: str,
    org_name: str | None = None,
) -> None:
    """Background task: send an email via Resend API."""
    resend.api_key = settings.resend_api_key

    if email_type == "magic_link":
        magic_url = f"{settings.frontend_url}/auth/magic-link?token={token}"
        resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to_email],
                "subject": "Your WrapFlow login link",
                "html": (
                    f"<p>Click the link below to log in:</p>"
                    f'<p><a href="{magic_url}">Log in to WrapFlow</a></p>'
                    f"<p>This link expires in 15 minutes.</p>"
                ),
            }
        )
        logger.info("Magic link email sent to %s", to_email)

    elif email_type == "onboarding_invite":
        onboarding_url = f"{settings.frontend_url}/onboard?token={token}"
        resend.Emails.send(
            {
                "from": settings.email_from,
                "to": [to_email],
                "subject": f"{org_name} - Start Your Project",
                "html": (
                    f"<p>{org_name} has invited you to start a project.</p>"
                    f"<p>Please fill out the onboarding form to get started:</p>"
                    f'<p><a href="{onboarding_url}">Start Onboarding</a></p>'
                    f"<p>This link expires in 7 days.</p>"
                ),
            }
        )
        logger.info("Onboarding invite sent to %s", to_email)

    else:
        raise ValueError(f"Unknown email type: {email_type}")


class WorkerSettings:
    functions = [
        func(render_generate, max_tries=2),  # 1 retry
        func(send_email, max_tries=4),  # 3 retries with backoff
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
