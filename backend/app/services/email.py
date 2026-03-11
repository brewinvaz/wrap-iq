import logging

import resend

from app.config import settings

logger = logging.getLogger("wrapiq")


async def send_magic_link_email(to_email: str, token: str) -> bool:
    """Send a magic-link email. Returns True on success, False on failure."""
    magic_url = f"{settings.frontend_url}/auth/magic-link?token={token}"

    if not settings.resend_api_key:
        logger.warning("Resend not configured — magic link email will not be sent")
        logger.info("[DEV] Magic link for %s: %s", to_email, magic_url)
        return False

    resend.api_key = settings.resend_api_key
    try:
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
    except Exception:
        logger.exception("Failed to send magic link email to %s", to_email)
        return False
    else:
        return True


async def send_onboarding_invite_email(
    to_email: str, token: str, org_name: str
) -> bool:
    """Send an onboarding invite email. Returns True on success, False on failure."""
    onboarding_url = f"{settings.frontend_url}/onboard?token={token}"

    if not settings.resend_api_key:
        logger.warning("Resend not configured — onboarding invite will not be sent")
        logger.info("[DEV] Onboarding invite for %s: %s", to_email, onboarding_url)
        return False

    resend.api_key = settings.resend_api_key
    try:
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
    except Exception:
        logger.exception("Failed to send onboarding invite email to %s", to_email)
        return False
    else:
        return True
