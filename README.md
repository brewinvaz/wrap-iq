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
