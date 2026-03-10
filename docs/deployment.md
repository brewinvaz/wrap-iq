# WrapIQ Deployment Guide

## Architecture

```
                    ┌─────────────┐
                    │   Frontend  │
                    │  (Next.js)  │
                    │   :3000     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Backend   │
                    │  (FastAPI)  │
                    │   :8000     │
                    └──┬──────┬───┘
                       │      │
                ┌──────▼┐  ┌──▼─────┐
                │  DB   │  │ Redis  │
                │ Pg 17 │  │  8.x   │
                └───────┘  └────────┘
                       │
                ┌──────▼──────┐
                │   Worker    │
                │   (arq)     │
                └─────────────┘
```

5 services: frontend, backend, worker, PostgreSQL, Redis.

## Option 1: Docker Compose (Self-Hosted)

### Prerequisites
- Docker and Docker Compose v2
- A server with at least 2GB RAM

### Steps

1. **Clone and configure:**
   ```bash
   git clone https://github.com/brewinvaz/wrap-iq.git
   cd wrap-iq
   cp .env.production.example .env.production
   ```

2. **Edit `.env.production`** — fill in all `CHANGE_ME` values:
   ```bash
   # Generate a strong secret key
   python3 -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

3. **Deploy:**
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```

4. **Verify:**
   ```bash
   # Check all services are running
   docker compose -f docker-compose.prod.yml ps

   # Check backend health
   curl http://localhost:8000/health

   # Check logs
   docker compose -f docker-compose.prod.yml logs -f
   ```

### Updating
```bash
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### Rollback
```bash
git checkout <previous-commit>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Option 2: Railway

Railway config files are included (`railway.toml` + `Dockerfile.railway` in both `backend/` and `frontend/`).

### Steps

1. Create a new Railway project
2. Add services: backend, frontend, PostgreSQL, Redis
3. Connect GitHub repo
4. Set root directories: `backend/` for backend, `frontend/` for frontend
5. Configure environment variables in Railway dashboard (same as `.env.production.example`)
6. Set `NEXT_PUBLIC_API_URL` as a build argument for the frontend service

Railway handles HTTPS/TLS termination, health checks, and auto-deploy on push to main.

## Pre-Deploy Checklist

- [ ] `SECRET_KEY` is a strong random value (not the dev default)
- [ ] `DATABASE_URL` uses production credentials (not `postgres:postgres`)
- [ ] `REDIS_PASSWORD` is set
- [ ] `DEBUG` is `false` (or unset — defaults to false)
- [ ] `CORS_ORIGINS` is set to your production domain
- [ ] `FRONTEND_URL` is set to your production domain
- [ ] `NEXT_PUBLIC_API_URL` points to your production backend URL
- [ ] HTTPS/TLS is configured (via reverse proxy or platform)
- [ ] Database backups are configured
- [ ] External API keys are set (Gemini, Resend, R2) if using those features

## Health Check

The backend exposes `GET /health` which returns `{"status": "ok"}`.

Use this for load balancer health checks, monitoring, and uptime services.

## Differences: Dev vs Production

| Setting | Dev | Production |
|---------|-----|------------|
| DEBUG | true | false |
| SECRET_KEY | dev default | strong random |
| DB credentials | postgres:postgres | unique per env |
| Redis | no password | password required |
| uvicorn | --reload | no reload |
| CORS | localhost:3000 | production domain |
| Frontend | development build | standalone build |
| Restart policy | unless-stopped | always |
| Volumes | source mounted | none (image only) |
