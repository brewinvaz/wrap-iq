import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.auth.permissions import require_admin, require_role
from app.models.user import Role, User
from app.schemas.auth import MessageResponse
from app.schemas.message_templates import (
    MessageLogResponse,
    MessageTemplateCreate,
    MessageTemplateListResponse,
    MessageTemplateResponse,
    MessageTemplateUpdate,
    SendMessageRequest,
)
from app.services.message_templates import MessageTemplateService

router = APIRouter(prefix="/api/message-templates", tags=["message-templates"])

require_admin_or_pm = require_role(Role.ADMIN, Role.PROJECT_MANAGER)


@router.get("", response_model=MessageTemplateListResponse)
async def list_templates(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = MessageTemplateService(session)
    templates = await service.list(user.organization_id)
    return MessageTemplateListResponse(items=templates)


@router.post(
    "", response_model=MessageTemplateResponse, status_code=status.HTTP_201_CREATED
)
async def create_template(
    body: MessageTemplateCreate,
    user: User = Depends(require_admin_or_pm),
    session: AsyncSession = Depends(get_session),
):
    service = MessageTemplateService(session)
    template = await service.create(
        organization_id=user.organization_id,
        name=body.name,
        subject=body.subject,
        body=body.body,
        trigger_type=body.trigger_type,
        trigger_stage_id=body.trigger_stage_id,
        channel=body.channel,
        is_active=body.is_active,
    )
    return template


@router.get("/{template_id}", response_model=MessageTemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = MessageTemplateService(session)
    try:
        template = await service.get(template_id, user.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return template


@router.patch("/{template_id}", response_model=MessageTemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    body: MessageTemplateUpdate,
    user: User = Depends(require_admin_or_pm),
    session: AsyncSession = Depends(get_session),
):
    service = MessageTemplateService(session)
    try:
        template = await service.update(
            template_id,
            user.organization_id,
            **body.model_dump(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return template


@router.delete("/{template_id}", response_model=MessageResponse)
async def delete_template(
    template_id: uuid.UUID,
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    service = MessageTemplateService(session)
    try:
        await service.delete(template_id, user.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return MessageResponse(message="Template deleted")


@router.post("/{template_id}/send", response_model=MessageLogResponse)
async def send_message(
    template_id: uuid.UUID,
    body: SendMessageRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = MessageTemplateService(session)
    try:
        log = await service.send(
            template_id=template_id,
            organization_id=user.organization_id,
            recipient_email=body.recipient_email,
            recipient_user_id=body.recipient_user_id,
            variables=body.variables,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return log


@router.get("/{template_id}/preview", response_model=MessageTemplateResponse)
async def preview_template(
    template_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = MessageTemplateService(session)
    try:
        template = await service.get(template_id, user.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    sample_variables = {
        "client_name": "John Doe",
        "project_name": "Tesla Model 3 Full Wrap",
        "status": "In Progress",
        "company_name": "WrapIQ Demo",
    }
    rendered_subject, rendered_body = service.render(template, sample_variables)

    return MessageTemplateResponse(
        id=template.id,
        organization_id=template.organization_id,
        name=template.name,
        subject=rendered_subject,
        body=rendered_body,
        trigger_type=template.trigger_type,
        trigger_stage_id=template.trigger_stage_id,
        channel=template.channel,
        is_active=template.is_active,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )
