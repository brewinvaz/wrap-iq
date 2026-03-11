"""Centralized logging configuration for WrapIQ backend.

- JSON format in production (DEBUG=false) for structured log aggregation.
- Human-readable format in development (DEBUG=true) for easy debugging.
- Log level: DEBUG when DEBUG=true, INFO when DEBUG=false.
"""

import json
import logging
import sys
from datetime import UTC, datetime


class JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        if record.stack_info:
            log_entry["stack_info"] = record.stack_info
        return json.dumps(log_entry, default=str)


_DEV_FORMAT = "%(asctime)s %(levelname)-8s [%(name)s] %(message)s"


def setup_logging(*, debug: bool) -> None:
    """Configure the root ``wrapiq`` logger (and stdlib root logger).

    Parameters
    ----------
    debug:
        When *True* use DEBUG level with a human-readable formatter.
        When *False* use INFO level with a JSON formatter.
    """
    level = logging.DEBUG if debug else logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    if debug:
        handler.setFormatter(logging.Formatter(_DEV_FORMAT))
    else:
        handler.setFormatter(JSONFormatter())

    # Configure the project-level logger
    wrapiq_logger = logging.getLogger("wrapiq")
    wrapiq_logger.setLevel(level)
    wrapiq_logger.handlers.clear()
    wrapiq_logger.addHandler(handler)
    # Allow propagation so pytest's caplog can capture log output
    wrapiq_logger.propagate = True

    # Also configure uvicorn loggers so their output matches our format
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(name)
        uv_logger.handlers.clear()
        uv_logger.addHandler(handler)
        uv_logger.propagate = False
