from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.admin import router as admin_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.auth import router as auth_router
from app.routers.client_portal import router as client_portal_router
from app.routers.kanban_stages import router as kanban_stages_router
from app.routers.notifications import router as notifications_router
from app.routers.users import router as users_router
from app.routers.vehicles import router as vehicles_router
from app.routers.vin import router as vin_router
from app.routers.work_orders import router as work_orders_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="WrapIQ API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(admin_router)
app.include_router(audit_logs_router)
app.include_router(auth_router)
app.include_router(client_portal_router)
app.include_router(kanban_stages_router)
app.include_router(notifications_router)
app.include_router(users_router)
app.include_router(vehicles_router)
app.include_router(vin_router)
app.include_router(work_orders_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
