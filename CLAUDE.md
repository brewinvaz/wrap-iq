# WrapIQ

## Project Structure
Monorepo: `frontend/` (Next.js 15, React 19) + `backend/` (FastAPI, Python 3.13) + Docker Compose

## Dev Commands
- `make up` / `make down` — start/stop all services (docker compose)
- `make logs` — tail all service logs
- `make test` — run backend tests (pytest in container)
- `make lint` / `make lint-fix` — ruff check/format backend
- Frontend: `cd frontend && npm run dev` (or via docker compose)
- Backend: `cd backend && uv run uvicorn app.main:app --reload` (or via docker compose)

## Package Managers
- Frontend: `npm` (lock: package-lock.json)
- Backend: `uv` (lock: uv.lock, config: pyproject.toml)

## Key Files
- `backend/app/main.py` — FastAPI entry point with lifespan, CORS, /health endpoint
- `backend/app/config.py` — Pydantic Settings (env-based config)
- `backend/app/db.py` — async SQLAlchemy engine/session
- `frontend/src/app/` — Next.js App Router pages

## Docker
- Container prefix: `wrapiq-*`
- DB port: 5433 (external) → 5432 (internal)
- Images: postgres:17-alpine, redis:8-alpine, node:22-alpine, python:3.13-slim

## Conventions
- Backend linting: ruff (select: E, F, I, N, W, UP)
- Backend test runner: pytest with asyncio_mode="auto"
- Frontend styling: Tailwind CSS 4 via @tailwindcss/postcss
- Next.js output: standalone (for Docker production builds)

## Code Change Workflow
All code changes MUST follow this workflow:
1. **GitHub Issue** — Create a GH issue first and add it to the WrapIQ GitHub project board (#7, owner: brewinvaz)
2. **Git Worktree** — Create a git worktree for the fix/feature branch (e.g. `.worktrees/<branch-name>`)
3. **Tests** — Add new tests or update existing tests for any code changes
4. **Pull Request** — Create a PR linking to the issue
5. **CI** — Watch CI until all checks pass; fix any failures
6. **Merge** — Rebase and merge the PR once CI is green
7. **Close Issue** — Move the issue to Done on the project board
8. **Sync Main** — Pull latest changes to local main branch and clean up worktree
