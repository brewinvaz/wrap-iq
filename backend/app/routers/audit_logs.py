import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.audit_log import ActionType
from app.models.user import User
from app.schemas.audit_logs import AuditLogListResponse
from app.services.audit_log import AuditLogService

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    action: ActionType | None = Query(None),
    resource_type: str | None = Query(None),
    resource_id: uuid.UUID | None = Query(None),
    user_id: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = AuditLogService(session)
    logs, total = await service.list_logs(
        organization_id=current_user.organization_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )
    return AuditLogListResponse(
        items=logs,
        total=total,
        limit=limit,
        offset=offset,
    )
