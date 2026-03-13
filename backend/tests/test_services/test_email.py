import logging
from unittest.mock import AsyncMock, patch

import pytest

from app.services.email import send_magic_link_email, send_onboarding_invite_email


@pytest.mark.asyncio
async def test_send_magic_link_dev_mode(caplog):
    """Dev mode (no API key) should log to console and return False."""
    with patch("app.services.email.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        mock_settings.frontend_url = "http://localhost:3000"

        with caplog.at_level(logging.INFO, logger="wrapiq"):
            result = await send_magic_link_email("user@test.com", "token123")

        assert result is False
        assert "token123" in caplog.text


@pytest.mark.asyncio
async def test_send_magic_link_enqueues_job():
    """Production mode should enqueue ARQ job and return True."""
    with (
        patch("app.services.email.settings") as mock_settings,
        patch(
            "app.services.email.get_arq_pool", new_callable=AsyncMock
        ) as mock_get_pool,
    ):
        mock_settings.resend_api_key = "re_test_key"
        mock_pool = AsyncMock()
        mock_get_pool.return_value = mock_pool

        result = await send_magic_link_email("user@test.com", "token123")

        assert result is True
        mock_pool.enqueue_job.assert_called_once_with(
            "send_email",
            email_type="magic_link",
            to_email="user@test.com",
            token="token123",
            org_name=None,
        )


@pytest.mark.asyncio
async def test_send_onboarding_invite_enqueues_job():
    """Production mode should enqueue onboarding invite job."""
    with (
        patch("app.services.email.settings") as mock_settings,
        patch(
            "app.services.email.get_arq_pool", new_callable=AsyncMock
        ) as mock_get_pool,
    ):
        mock_settings.resend_api_key = "re_test_key"
        mock_pool = AsyncMock()
        mock_get_pool.return_value = mock_pool

        result = await send_onboarding_invite_email(
            "client@test.com", "token456", "Test Wraps Co"
        )

        assert result is True
        mock_pool.enqueue_job.assert_called_once_with(
            "send_email",
            email_type="onboarding_invite",
            to_email="client@test.com",
            token="token456",
            org_name="Test Wraps Co",
        )


@pytest.mark.asyncio
async def test_send_onboarding_invite_dev_mode(caplog):
    """Dev mode should log to console and return False."""
    with patch("app.services.email.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        mock_settings.frontend_url = "http://localhost:3000"

        with caplog.at_level(logging.INFO, logger="wrapiq"):
            result = await send_onboarding_invite_email(
                "client@test.com", "token456", "Test Wraps Co"
            )

        assert result is False
        assert "token456" in caplog.text
