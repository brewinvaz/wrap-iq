import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings
from app.db import async_session
from app.logging_config import setup_logging
from app.middleware.rate_limit import limiter
from app.routers.admin import router as admin_router
from app.routers.ai_assistant import router as ai_assistant_router
from app.routers.api_keys import router as api_keys_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.auth import router as auth_router
from app.routers.chat_monitoring import router as chat_monitoring_router
from app.routers.client_invites import router as client_invites_router
from app.routers.client_portal import router as client_portal_router
from app.routers.clients import router as clients_router
from app.routers.csv_upload import router as csv_upload_router
from app.routers.discrepancy_detection import router as discrepancy_detection_router
from app.routers.equipment import router as equipment_router
from app.routers.estimate_defaults import router as estimate_defaults_router
from app.routers.estimates import router as estimates_router
from app.routers.invoices import router as invoices_router
from app.routers.kanban_stages import router as kanban_stages_router
from app.routers.message_templates import router as message_templates_router
from app.routers.notifications import router as notifications_router
from app.routers.onboarding import router as onboarding_router
from app.routers.pay import router as pay_router
from app.routers.renders import router as renders_router
from app.routers.sidebar import router as sidebar_router
from app.routers.subscriptions import router as subscriptions_router
from app.routers.superadmin import router as superadmin_router
from app.routers.time_logs import router as time_logs_router
from app.routers.users import router as users_router
from app.routers.vehicle_detection import router as vehicle_detection_router
from app.routers.vehicles import router as vehicles_router
from app.routers.vin import router as vin_router
from app.routers.webhooks import router as webhooks_router
from app.routers.work_order_photos import router as work_order_photos_router
from app.routers.work_orders import router as work_orders_router

logger = logging.getLogger("wrapiq")


setup_logging(debug=settings.debug)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — log external service status
    logger.info(
        "Gemini AI: %s",
        "configured" if settings.gemini_api_key else "not configured",
    )
    logger.info(
        "Resend Email: %s",
        "configured"
        if settings.resend_api_key
        else "not configured (emails will print to console)",
    )
    logger.info(
        "Cloudflare R2: %s",
        "configured"
        if settings.r2_account_id
        else "not configured (file uploads disabled)",
    )
    yield
    # Shutdown


app = FastAPI(
    title="WrapIQ API",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)


# ---------------------------------------------------------------------------
# Middleware: reject request bodies larger than 10 MB (413 Payload Too Large)
# ---------------------------------------------------------------------------
MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request body too large. Maximum size is 10 MB."},
        )
    return await call_next(request)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.exception(
        "Database integrity error on %s %s", request.method, request.url.path
    )
    return JSONResponse(
        status_code=409,
        content={"detail": "A database conflict occurred. Please check your data."},
    )


@app.exception_handler(DBAPIError)
async def dbapi_error_handler(request: Request, exc: DBAPIError):
    logger.exception(
        "Database connection error on %s %s", request.method, request.url.path
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "A database error occurred. Please try again later."},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred. Please try again later."},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(ai_assistant_router)
app.include_router(api_keys_router)
app.include_router(chat_monitoring_router)
app.include_router(client_invites_router)
app.include_router(admin_router)
app.include_router(audit_logs_router)
app.include_router(auth_router)
app.include_router(client_portal_router)
app.include_router(clients_router)
app.include_router(csv_upload_router)
app.include_router(discrepancy_detection_router)
app.include_router(equipment_router)
app.include_router(estimate_defaults_router)
app.include_router(estimates_router)
app.include_router(invoices_router)
app.include_router(kanban_stages_router)
app.include_router(message_templates_router)
app.include_router(notifications_router)
app.include_router(onboarding_router)
app.include_router(pay_router)
app.include_router(renders_router)
app.include_router(sidebar_router)
app.include_router(subscriptions_router)
app.include_router(superadmin_router)
app.include_router(time_logs_router)
app.include_router(users_router)
app.include_router(vehicle_detection_router)
app.include_router(vehicles_router)
app.include_router(vin_router)
app.include_router(webhooks_router)
app.include_router(work_order_photos_router)
app.include_router(work_orders_router)


@app.get("/health")
async def health():
    status = {"app": "ok", "db": "ok", "redis": "ok"}
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        status["db"] = "unavailable"
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
    except Exception:
        status["redis"] = "unavailable"

    # Only DB is critical for health check (Railway uses this for readiness)
    healthy = status["db"] == "ok"
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={"status": "ok" if healthy else "degraded", "services": status},
    )
