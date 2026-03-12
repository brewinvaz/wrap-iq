# WrapIQ

Full-stack application with Next.js frontend, FastAPI backend, PostgreSQL, and Redis.

## Quick Start

```bash
# Start all services
make up

# View logs
make logs

# Stop all services
make down
```

## Services

| Service  | URL                    | Description        |
|----------|------------------------|--------------------|
| Frontend | http://localhost:3000   | Next.js app        |
| Backend  | http://localhost:8000   | FastAPI server     |
| Postgres | localhost:5433         | Database           |
| Redis    | localhost:6379         | Cache / Job queue  |

## Development

```bash
make help          # Show all available commands
make build         # Build all services
make test          # Run backend tests
make lint          # Run linting
make migrate       # Run database migrations
```

## Seeding Superadmins

### Local

```bash
cd backend
SUPERADMIN_PASSWORD=yourpassword uv run python -m app.cli.seed_superadmin
```

### Railway (Production)

1. Open the Railway dashboard and go to the `api` service
2. Open a shell (three dots menu → Shell)
3. Run:

```bash
SUPERADMIN_PASSWORD=yourpassword uv run python -m app.cli.seed_superadmin
```

This creates or updates the default superadmin accounts (`brewin@bluemintiq.com`, `rini@bluemintiq.com`). Without `SUPERADMIN_PASSWORD`, a random password is generated.

To seed a specific email instead:

```bash
SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD=yourpassword uv run python -m app.cli.seed_superadmin
```
