import logging
from unittest.mock import patch

import pytest

from app.services.email import send_magic_link_email


@pytest.mark.asyncio
async def test_send_magic_link_dev_mode(caplog):
    with patch("app.services.email.settings") as mock_settings:
        mock_settings.resend_api_key = ""
        mock_settings.frontend_url = "http://localhost:3000"
        mock_settings.email_from = "test@test.com"

        with caplog.at_level(logging.INFO, logger="wrapiq"):
            await send_magic_link_email("user@test.com", "token123")

        assert "token123" in caplog.text
