"""Tests for the centralized logging configuration."""

import json
import logging

import pytest

from app.logging_config import setup_logging


@pytest.fixture(autouse=True)
def _reset_logging():
    """Capture and restore logging config around each test."""
    # Grab current handler state so we can restore after the test
    wrapiq_logger = logging.getLogger("wrapiq")
    uvicorn_logger = logging.getLogger("uvicorn")
    old_wrapiq_handlers = list(wrapiq_logger.handlers)
    old_wrapiq_level = wrapiq_logger.level
    old_uvicorn_handlers = list(uvicorn_logger.handlers)
    old_uvicorn_level = uvicorn_logger.level
    yield
    wrapiq_logger.handlers = old_wrapiq_handlers
    wrapiq_logger.setLevel(old_wrapiq_level)
    uvicorn_logger.handlers = list(old_uvicorn_handlers)
    uvicorn_logger.setLevel(old_uvicorn_level)


class TestSetupLoggingDebug:
    """Tests for development (debug=True) logging."""

    def test_sets_debug_level(self):
        setup_logging(debug=True)
        logger = logging.getLogger("wrapiq")
        assert logger.level == logging.DEBUG

    def test_human_readable_format(self, capsys):
        setup_logging(debug=True)
        logger = logging.getLogger("wrapiq")
        logger.info("hello dev")
        captured = capsys.readouterr()
        # Human-readable format should NOT be JSON
        assert "hello dev" in captured.out
        prefix = captured.out.split("hello dev")[0]
        assert "{" not in prefix or "timestamp" not in captured.out

    def test_child_logger_inherits(self):
        setup_logging(debug=True)
        child = logging.getLogger("wrapiq.services.test")
        assert child.getEffectiveLevel() == logging.DEBUG


class TestSetupLoggingProduction:
    """Tests for production (debug=False) logging."""

    def test_sets_info_level(self):
        setup_logging(debug=False)
        logger = logging.getLogger("wrapiq")
        assert logger.level == logging.INFO

    def test_json_format(self, capsys):
        setup_logging(debug=False)
        logger = logging.getLogger("wrapiq")
        logger.info("hello prod")
        captured = capsys.readouterr()
        # Should be valid JSON with expected keys
        line = captured.out.strip()
        parsed = json.loads(line)
        assert parsed["message"] == "hello prod"
        assert parsed["level"] == "INFO"
        assert parsed["logger"] == "wrapiq"
        assert "timestamp" in parsed

    def test_uvicorn_logger_configured(self):
        setup_logging(debug=False)
        uvicorn_logger = logging.getLogger("uvicorn")
        assert uvicorn_logger.level == logging.INFO
        assert len(uvicorn_logger.handlers) > 0

    def test_child_logger_inherits(self):
        setup_logging(debug=False)
        child = logging.getLogger("wrapiq.services.test")
        assert child.getEffectiveLevel() == logging.INFO
