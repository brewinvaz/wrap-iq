import logging

from app.config import settings
from app.services.arq import get_arq_pool

logger = logging.getLogger("wrapiq")


async def send_magic_link_email(to_email: str, token: str) -> bool:
    """Send a magic-link email. Returns True if enqueued, False in dev mode."""
    if not settings.resend_api_key:
        magic_url = f"{settings.frontend_url}/auth/magic-link?token={token}"
        logger.warning("Resend not configured — magic link email will not be sent")
        logger.info("[DEV] Magic link for %s: %s", to_email, magic_url)
        return False

    pool = await get_arq_pool()
    await pool.enqueue_job(
        "send_email",
        email_type="magic_link",
        to_email=to_email,
        token=token,
        org_name=None,
    )
    return True


async def send_onboarding_invite_email(
    to_email: str, token: str, org_name: str
) -> bool:
    """Send an onboarding invite email. Returns True if enqueued, False in dev mode."""
    if not settings.resend_api_key:
        onboarding_url = f"{settings.frontend_url}/onboard?token={token}"
        logger.warning("Resend not configured — onboarding invite will not be sent")
        logger.info("[DEV] Onboarding invite for %s: %s", to_email, onboarding_url)
        return False

    pool = await get_arq_pool()
    await pool.enqueue_job(
        "send_email",
        email_type="onboarding_invite",
        to_email=to_email,
        token=token,
        org_name=org_name,
    )
    return True
