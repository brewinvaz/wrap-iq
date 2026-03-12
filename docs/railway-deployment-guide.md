# WrapIQ — Railway Deployment Guide

## Architecture on Railway

You'll create **4 services** in a single Railway project:

| Service | Type | Source Directory | Notes |
|---------|------|-----------------|-------|
| **backend** | Web Service (Dockerfile) | `/backend` | FastAPI API + runs migrations on startup |
| **frontend** | Web Service (Dockerfile) | `/frontend` | Next.js standalone |
| **worker** | Worker Service (Dockerfile) | `/backend` | arq job queue processor (same image, different CMD) |
| **postgres** | Railway Plugin | — | Managed PostgreSQL |
| **redis** | Railway Plugin | — | Managed Redis |

---

## Step 1: Create the Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project** → **Empty Project**
3. Name it `wrapiq` (or whatever you prefer)

---

## Step 2: Add PostgreSQL and Redis

### PostgreSQL
1. In the project canvas, click **+ New** → **Database** → **PostgreSQL**
2. Railway provisions it instantly and creates connection variables
3. Note: Railway provides `DATABASE_URL` automatically, but it uses the `postgresql://` scheme. You need `postgresql+asyncpg://` — we'll handle that in env vars below

### Redis
1. Click **+ New** → **Database** → **Redis**
2. Railway provides `REDIS_URL` automatically — this works as-is

---

## Step 3: Deploy the Backend

1. Click **+ New** → **GitHub Repo** → select `brewinvaz/wrap-iq`
2. In **Settings**:
   - **Root Directory**: `backend`
   - **Builder**: Dockerfile (auto-detected from `railway.toml`)
3. Railway will auto-detect `railway.toml` and use `Dockerfile.railway`

### Backend Environment Variables

In the backend service's **Variables** tab, set these:

#### Required (Railway provides some automatically)

```bash
# Database — IMPORTANT: Use postgresql+asyncpg:// scheme, NOT postgresql://
# Reference the Railway-provided Postgres variables:
DATABASE_URL=postgresql+asyncpg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}

# Redis — Reference Railway-provided Redis URL
REDIS_URL=${{Redis.REDIS_URL}}

# Security — Generate a strong key:
# python -c "import secrets; print(secrets.token_urlsafe(64))"
SECRET_KEY=<generate-a-64-char-secret>

# CORS — Your frontend Railway domain (update after frontend deploys)
CORS_ORIGINS=https://your-frontend.up.railway.app
FRONTEND_URL=https://your-frontend.up.railway.app

# Production mode
DEBUG=false
```

#### JWT (can use defaults, or override)

```bash
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

#### External Services

```bash
# Google Gemini AI
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_RENDER_MODEL=gemini-2.5-flash-image

# Resend (email)
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM=WrapFlow <noreply@yourdomain.com>

# Cloudflare R2 (file storage)
R2_ACCOUNT_ID=<your-r2-account-id>
R2_ACCESS_KEY_ID=<your-r2-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret-key>
R2_BUCKET_NAME=wrapiq-uploads
R2_PUBLIC_URL=https://your-r2-public-url.com
```

---

## Step 4: Deploy the Worker

The worker uses the **same codebase** as the backend but with a different start command.

1. Click **+ New** → **GitHub Repo** → select `brewinvaz/wrap-iq` again
2. In **Settings**:
   - **Root Directory**: `backend`
   - **Builder**: Dockerfile
3. Override the **Start Command** in Settings (or create a `railway-worker.toml`):
   ```
   uv run arq app.worker.WorkerSettings
   ```
4. **Copy all environment variables** from the backend service (or use Railway's shared variables/references)

> **Important**: The worker does NOT need a healthcheck or public domain. In Settings, make sure **no domain** is assigned.

### Alternative: Worker railway.toml

Create `/backend/railway-worker.toml` if you want it config-driven:

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile.railway"

[deploy]
startCommand = "uv run arq app.worker.WorkerSettings"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

Then set this service's **Config File** to `railway-worker.toml` in Railway settings.

---

## Step 5: Deploy the Frontend

1. Click **+ New** → **GitHub Repo** → select `brewinvaz/wrap-iq` again
2. In **Settings**:
   - **Root Directory**: `frontend`
   - **Builder**: Dockerfile (auto-detected from `railway.toml`)

### Frontend Environment Variables

```bash
# The backend's public URL (get this from backend service's Settings → Domains)
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

> **Critical**: `NEXT_PUBLIC_API_URL` is baked into the frontend at **build time** (it's a `NEXT_PUBLIC_` var). If you change the backend URL, you must **redeploy the frontend** for the change to take effect.

---

## Step 6: Configure Domains

### Railway Default Domains
Each web service gets a `*.up.railway.app` domain automatically. After all services deploy:

1. **Backend**: Go to Settings → Domains → copy the URL (e.g., `wrapiq-backend.up.railway.app`)
2. **Frontend**: Go to Settings → Domains → copy the URL (e.g., `wrapiq-frontend.up.railway.app`)

### Update Cross-References
Once you have both domains:
1. **Backend vars**: Update `CORS_ORIGINS` and `FRONTEND_URL` to the frontend domain
2. **Frontend vars**: Update `NEXT_PUBLIC_API_URL` to the backend domain
3. **Redeploy both services** (Frontend MUST be redeployed since NEXT_PUBLIC_API_URL is build-time)

### Custom Domains (recommended for production)
1. In each service's Settings → Domains → **Add Custom Domain**
2. Railway provides the CNAME record to add to your DNS
3. Example setup:
   - `app.wrapflow.io` → frontend service
   - `api.wrapflow.io` → backend service
4. Update all env vars to use your custom domains
5. Railway handles SSL automatically

---

## Step 7: Verify Deployment

1. **Backend health**: `curl https://your-backend.up.railway.app/health`
   - Should return `{"status": "ok", "services": {"app": "ok", "db": "ok", "redis": "ok"}}`
2. **Frontend**: Open `https://your-frontend.up.railway.app` in browser
3. **Logs**: Check each service's logs in Railway dashboard for errors

---

## Environment Variables — Complete Reference

### Backend Service

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | — | Must use `postgresql+asyncpg://` scheme |
| `REDIS_URL` | Yes | — | Use Railway reference variable |
| `SECRET_KEY` | Yes | — | Min 32 chars, use `secrets.token_urlsafe(64)` |
| `CORS_ORIGINS` | Yes | — | Comma-separated origins (frontend URL) |
| `FRONTEND_URL` | Yes | — | Full frontend URL (used for email links, etc.) |
| `DEBUG` | Yes | `false` | **Must be `false` in production** |
| `JWT_ALGORITHM` | No | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `30` | |
| `GEMINI_API_KEY` | No | `""` | AI features disabled if empty |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | |
| `GEMINI_RENDER_MODEL` | No | `gemini-2.5-flash-image` | |
| `RESEND_API_KEY` | No | `""` | Emails print to console if empty |
| `EMAIL_FROM` | No | `WrapFlow <noreply@wrapflow.io>` | |
| `R2_ACCOUNT_ID` | No | `""` | File uploads disabled if empty |
| `R2_ACCESS_KEY_ID` | No | `""` | |
| `R2_SECRET_ACCESS_KEY` | No | `""` | |
| `R2_BUCKET_NAME` | No | `wrapiq-uploads` | |
| `R2_PUBLIC_URL` | No | `""` | CDN URL for uploaded files |
| `PORT` | Auto | `8000` | Railway injects this automatically |

### Frontend Service

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL — **build-time only** |
| `PORT` | Auto | Railway injects `3000` automatically |

### Worker Service

Same as Backend — copy all backend env vars.

---

## Third-Party Provider Changes

### Cloudflare R2

Your R2 bucket needs CORS configured to allow requests from your Railway frontend domain:

1. Go to Cloudflare Dashboard → R2 → your bucket → **Settings** → **CORS Policy**
2. Add a rule:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://your-frontend.up.railway.app",
         "https://app.wrapflow.io"
       ],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. If using a custom R2 public domain, update `R2_PUBLIC_URL` accordingly

### Resend (Email)

1. Go to [resend.com](https://resend.com) → **Domains**
2. Verify your production sending domain (e.g., `wrapflow.io`)
3. Add the required DNS records (SPF, DKIM, DMARC) to your DNS provider
4. Update `EMAIL_FROM` to use your verified domain
5. If using magic links or email invites, ensure `FRONTEND_URL` is correct — email links will point there

### Google Gemini

No changes needed — the API key works from any origin. Just ensure your `GEMINI_API_KEY` is set in the backend and worker services.

### DNS Provider (for custom domains)

For each custom domain, add a CNAME record pointing to Railway:
```
app.wrapflow.io  → CNAME → <railway-provided-target>
api.wrapflow.io  → CNAME → <railway-provided-target>
```
Railway provides the exact CNAME target when you add a custom domain.

---

## Deployment Workflow

Railway auto-deploys on push to `main` by default. To change this:

1. **Per service** → Settings → **Trigger** → choose branch and enable/disable auto-deploy
2. For manual deploys: Railway Dashboard → service → **Deploy** button

### Recommended Setup
- **Auto-deploy on push to `main`** for all services
- Railway builds each service independently (only rebuilds if files in its root directory change)

---

## Cost Optimization Tips

1. **Worker service**: If you're not using background jobs yet, you can skip the worker service and add it later
2. **Starter plan**: Railway's Hobby plan ($5/mo) includes 8 GB RAM, 8 vCPU — sufficient for starting out
3. **Sleep**: Enable sleep for non-production environments to reduce costs
4. **Postgres**: Railway's managed Postgres is included — no separate charge beyond resource usage

---

## Troubleshooting

### "Database connection refused" on first deploy
The backend starts before Postgres is ready. The healthcheck will fail initially, and Railway will retry. The `restartPolicyMaxRetries = 5` handles this. If it persists, increase `healthcheckTimeout`.

### Migrations fail
- Check logs: Railway Dashboard → backend service → **Logs**
- Ensure `DATABASE_URL` uses `postgresql+asyncpg://` (not `postgresql://`)
- The CMD runs migrations before starting uvicorn — if migration fails, the container exits and Railway retries

### Frontend shows "Network Error" / can't reach API
- `NEXT_PUBLIC_API_URL` is baked at build time. If you changed the backend URL, **redeploy the frontend**
- Check `CORS_ORIGINS` on the backend includes the exact frontend URL (no trailing slash)

### Health check fails
- Backend healthcheck hits `/health` — verify the database and Redis connections
- If Redis is "unavailable" in health response, check `REDIS_URL` variable

### Build fails on frontend
- Ensure `NEXT_PUBLIC_API_URL` is set as a build-time variable (not just runtime)
- Check Railway build logs for TypeScript errors

---

## Railway CLI (optional)

Install for local management:

```bash
npm install -g @railway/cli
railway login
railway link  # link to your project
railway up    # manual deploy
railway logs  # stream logs
railway variables  # view env vars
```
