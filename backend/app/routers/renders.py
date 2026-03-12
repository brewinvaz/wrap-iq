import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.config import settings
from app.middleware.rate_limit import limiter
from app.models.render import RenderStatus
from app.models.user import User
from app.schemas.renders import (
    RenderCreate,
    RenderListResponse,
    RenderRegenerate,
    RenderResponse,
    RenderUploadRequest,
    RenderUploadResponse,
    SharedRenderResponse,
    ShareResponse,
    UploadInfo,
)
from app.services import renders as render_service
from app.services.r2 import (
    generate_download_url,
    generate_object_key,
    generate_upload_url,
    is_r2_configured,
)

router = APIRouter(prefix="/api/renders", tags=["renders"])


@router.post("/upload-urls", response_model=RenderUploadResponse)
async def get_upload_urls(
    body: RenderUploadRequest,
    user: User = Depends(get_current_user),
):
    if not is_r2_configured():
        raise HTTPException(status_code=503, detail="File uploads not configured")

    uploads = []
    for file_info in body.files:
        key = generate_object_key(
            user.organization_id, file_info.filename, prefix="renders"
        )
        url = generate_upload_url(key, file_info.content_type)
        uploads.append(UploadInfo(r2_key=key, upload_url=url))

    return RenderUploadResponse(uploads=uploads)


@router.post(
    "",
    response_model=RenderResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def create_render(
    request: Request,
    response: Response,
    body: RenderCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    try:
        render = await render_service.create_render(
            session=session,
            user=user,
            design_name=body.design_name,
            description=body.description,
            vehicle_photo_key=body.vehicle_photo_key,
            wrap_design_key=body.wrap_design_key,
            work_order_id=body.work_order_id,
            client_id=body.client_id,
            vehicle_id=body.vehicle_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return render_service.build_render_response(render)


@router.get("", response_model=RenderListResponse)
async def list_renders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    client_id: uuid.UUID | None = Query(None),
    work_order_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None, max_length=200),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    items, total = await render_service.list_renders(
        session=session,
        org_id=user.organization_id,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
        client_id=client_id,
        work_order_id=work_order_id,
        search=search,
    )
    return RenderListResponse(
        items=[render_service.build_render_response(r) for r in items],
        total=total,
    )


@router.get("/shared/{token}", response_model=SharedRenderResponse)
async def get_shared_render(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    render = await render_service.get_render_by_share_token(session, token)
    if not render or render.status != RenderStatus.COMPLETED:
        raise HTTPException(status_code=404, detail="Render not found")

    return SharedRenderResponse(
        design_name=render.design_name,
        result_image_url=generate_download_url(render.result_image_key),
        created_at=render.created_at,
    )


@router.get("/{render_id}", response_model=RenderResponse)
async def get_render(
    render_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    render = await render_service.get_render(session, render_id, user.organization_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
    return render_service.build_render_response(render)


@router.delete("/{render_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_render(
    render_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    render = await render_service.get_render(session, render_id, user.organization_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
    await render_service.delete_render(session, render)


@router.post("/{render_id}/regenerate", response_model=RenderResponse)
@limiter.limit("5/minute")
async def regenerate_render(
    request: Request,
    response: Response,
    render_id: uuid.UUID,
    body: RenderRegenerate | None = None,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    render = await render_service.get_render(session, render_id, user.organization_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")

    try:
        render = await render_service.regenerate_render(
            session, render, description=body.description if body else None
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return render_service.build_render_response(render)


@router.post("/{render_id}/share", response_model=ShareResponse)
async def share_render(
    render_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    render = await render_service.get_render(session, render_id, user.organization_id)
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
    if render.status != RenderStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Render must be completed to share")

    token = await render_service.generate_share_token(session, render)
    share_url = f"{settings.frontend_url}/render/{token}"
    return ShareResponse(share_url=share_url)
