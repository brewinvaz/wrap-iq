#!/bin/bash
set -e

echo "Running database migrations..."
uv run alembic upgrade head || echo "No migrations to run or alembic not configured yet"

echo "Starting uvicorn..."
if [ "${DEBUG:-false}" = "true" ]; then
  exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
  exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
fi
