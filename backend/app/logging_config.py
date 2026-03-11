"""Centralized logging configuration for WrapIQ.

- Production (DEBUG=false): structured JSON logs at INFO level
- Development (DEBUG=true): human-readable coloured logs at DEBUG level

Call ``setup_logging()`` once at application startup (e.g. in the FastAPI
lifespan) to apply the configuration via ``logging.config.dictConfig``.
"""

import logging
import logging.config
from typing import Any


def _build_config(*, debug: bool) -> dict[str, Any]:
    level = "DEBUG" if debug else "INFO"

    if debug:
        formatter = {
            "format": "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    else:
        # Structured JSON formatter for production log aggregators
        formatter = {
            "()": "logging.Formatter",
            "format": (
                '{"timestamp":"%(asctime)s",'
                '"level":"%(levelname)s",'
                '"logger":"%(name)s",'
                '"message":"%(message)s"}'
            ),
            "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        }

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": formatter,
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "wrapiq": {
                "level": level,
                "handlers": ["console"],
                "propagate": False,
            },
            "uvicorn": {
                "level": level,
                "handlers": ["console"],
                "propagate": False,
            },
            "uvicorn.error": {
                "level": level,
                "handlers": ["console"],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": level,
                "handlers": ["console"],
                "propagate": False,
            },
        },
        "root": {
            "level": "WARNING",
            "handlers": ["console"],
        },
    }


def setup_logging(*, debug: bool) -> None:
    """Apply the centralized logging configuration.

    Parameters
    ----------
    debug:
        When ``True`` use human-readable DEBUG-level output; otherwise use
        structured JSON at INFO level.
    """
    config = _build_config(debug=debug)
    logging.config.dictConfig(config)
