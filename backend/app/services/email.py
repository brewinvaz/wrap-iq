import resend

from app.config import settings


async def send_magic_link_email(to_email: str, token: str) -> None:
    magic_url = f"{settings.frontend_url}/auth/magic-link?token={token}"

    if not settings.resend_api_key:
        print(f"\n[DEV] Magic link for {to_email}: {magic_url}\n")
        return

    resend.api_key = settings.resend_api_key
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


async def send_onboarding_invite_email(
    to_email: str, token: str, org_name: str
) -> None:
    onboarding_url = f"{settings.frontend_url}/onboard?token={token}"

    if not settings.resend_api_key:
        print(f"\n[DEV] Onboarding invite for {to_email}: {onboarding_url}\n")
        return

    resend.api_key = settings.resend_api_key
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
