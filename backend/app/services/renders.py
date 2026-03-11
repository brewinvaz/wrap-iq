import logging
import secrets
import uuid

from google import genai
from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.client import Client
from app.models.render import Render, RenderStatus
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.work_order import WorkOrder
from app.schemas.renders import RenderResponse
from app.services.r2 import (
    delete_object,
    download_object,
    generate_download_url,
    generate_object_key,
    upload_object,
)

logger = logging.getLogger("wrapiq")

RENDER_MODEL = "gemini-2.5-flash-image"


def build_prompt(description: str | None) -> str:
    base = (
        "Apply the vehicle wrap design (second image) onto the vehicle shown "
        "in the first image. The wrap should follow the vehicle's contours, "
        "match the lighting and perspective, and look realistic."
    )
    if description:
        return f"{base} {description}"
    return base


def build_render_response(render: Render) -> RenderResponse:
    creator_name = None
    if render.creator:
        creator_name = render.creator.full_name or render.creator.email

    return RenderResponse(
        id=render.id,
        design_name=render.design_name,
        description=render.description,
        status=render.status.value,
        vehicle_photo_url=generate_download_url(render.vehicle_photo_key),
        wrap_design_url=generate_download_url(render.wrap_design_key),
        result_image_url=(
            generate_download_url(render.result_image_key)
            if render.result_image_key
            else None
        ),
        share_token=render.share_token,
        error_message=render.error_message,
        work_order_id=render.work_order_id,
        client_id=render.client_id,
        vehicle_id=render.vehicle_id,
        created_by=render.created_by,
        created_by_name=creator_name,
        created_at=render.created_at,
        updated_at=render.updated_at,
    )


async def validate_ownership(
    session: AsyncSession,
    org_id: uuid.UUID,
    work_order_id: uuid.UUID | None,
    client_id: uuid.UUID | None,
    vehicle_id: uuid.UUID | None,
) -> None:
    if work_order_id:
        result = await session.execute(
            select(WorkOrder).where(
                WorkOrder.id == work_order_id,
                WorkOrder.organization_id == org_id,
            )
        )
        if not result.scalar_one_or_none():
            raise ValueError("Work order not found")

    if client_id:
        result = await session.execute(
            select(Client).where(
                Client.id == client_id,
                Client.organization_id == org_id,
            )
        )
        if not result.scalar_one_or_none():
            raise ValueError("Client not found")

    if vehicle_id:
        result = await session.execute(
            select(Vehicle).where(
                Vehicle.id == vehicle_id,
                Vehicle.organization_id == org_id,
            )
        )
        if not result.scalar_one_or_none():
            raise ValueError("Vehicle not found")


def _mime_type_from_key(key: str) -> str:
    """Infer MIME type from R2 object key extension."""
    lower = key.lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".pdf"):
        return "application/pdf"
    return "image/jpeg"


async def generate_image(
    vehicle_photo_key: str,
    wrap_design_key: str,
    description: str | None,
) -> bytes:
    if not settings.gemini_api_key:
        raise RuntimeError("AI features are not configured. Set GEMINI_API_KEY.")

    vehicle_photo = download_object(vehicle_photo_key)
    wrap_design = download_object(wrap_design_key)

    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = build_prompt(description)

    response = await client.aio.models.generate_content(
        model=RENDER_MODEL,
        contents=[
            types.Part.from_bytes(
                data=vehicle_photo,
                mime_type=_mime_type_from_key(vehicle_photo_key),
            ),
            types.Part.from_bytes(
                data=wrap_design,
                mime_type=_mime_type_from_key(wrap_design_key),
            ),
            prompt,
        ],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio="16:9"),
        ),
    )

    for part in response.parts:
        if part.inline_data:
            return part.inline_data.data

    raise RuntimeError("Gemini did not return an image")


async def create_render(
    session: AsyncSession,
    user: User,
    design_name: str,
    description: str | None,
    vehicle_photo_key: str,
    wrap_design_key: str,
    work_order_id: uuid.UUID | None,
    client_id: uuid.UUID | None,
    vehicle_id: uuid.UUID | None,
) -> Render:
    org_prefix = f"{user.organization_id}/"
    if not vehicle_photo_key.startswith(org_prefix):
        raise ValueError("Invalid vehicle photo key")
    if not wrap_design_key.startswith(org_prefix):
        raise ValueError("Invalid wrap design key")

    await validate_ownership(
        session, user.organization_id, work_order_id, client_id, vehicle_id
    )

    render = Render(
        organization_id=user.organization_id,
        design_name=design_name,
        description=description,
        vehicle_photo_key=vehicle_photo_key,
        wrap_design_key=wrap_design_key,
        work_order_id=work_order_id,
        client_id=client_id,
        vehicle_id=vehicle_id,
        created_by=user.id,
        status=RenderStatus.PENDING,
    )
    session.add(render)
    await session.flush()

    render.status = RenderStatus.RENDERING
    await session.flush()

    try:
        result_bytes = await generate_image(
            vehicle_photo_key, wrap_design_key, description
        )
        result_key = generate_object_key(
            user.organization_id, "result.jpg", prefix="renders"
        )
        upload_object(result_key, result_bytes, "image/jpeg")
        render.result_image_key = result_key
        render.status = RenderStatus.COMPLETED
    except Exception as exc:
        logger.exception("Render generation failed")
        render.status = RenderStatus.FAILED
        render.error_message = str(exc)[:500]

    await session.commit()
    await session.refresh(render)
    return render


async def list_renders(
    session: AsyncSession,
    org_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    status_filter: str | None = None,
    client_id: uuid.UUID | None = None,
    work_order_id: uuid.UUID | None = None,
    search: str | None = None,
) -> tuple[list[Render], int]:
    query = select(Render).where(Render.organization_id == org_id)
    count_query = (
        select(func.count()).select_from(Render).where(Render.organization_id == org_id)
    )

    if status_filter:
        query = query.where(Render.status == status_filter)
        count_query = count_query.where(Render.status == status_filter)
    if client_id:
        query = query.where(Render.client_id == client_id)
        count_query = count_query.where(Render.client_id == client_id)
    if work_order_id:
        query = query.where(Render.work_order_id == work_order_id)
        count_query = count_query.where(Render.work_order_id == work_order_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(Render.design_name.ilike(pattern))
        count_query = count_query.where(Render.design_name.ilike(pattern))

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Render.created_at.desc()).offset(skip).limit(limit)
    result = await session.execute(query)
    items = list(result.scalars().all())

    return items, total


async def get_render(
    session: AsyncSession, render_id: uuid.UUID, org_id: uuid.UUID
) -> Render | None:
    result = await session.execute(
        select(Render).where(
            Render.id == render_id,
            Render.organization_id == org_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_render(session: AsyncSession, render: Render) -> None:
    for key in [
        render.vehicle_photo_key,
        render.wrap_design_key,
        render.result_image_key,
    ]:
        if key:
            try:
                delete_object(key)
            except Exception:
                logger.warning("Failed to delete R2 object: %s", key)
    await session.delete(render)
    await session.commit()


async def regenerate_render(
    session: AsyncSession,
    render: Render,
    description: str | None = None,
) -> Render:
    if description is not None:
        render.description = description

    render.status = RenderStatus.RENDERING
    render.error_message = None
    await session.flush()

    try:
        result_bytes = await generate_image(
            render.vehicle_photo_key,
            render.wrap_design_key,
            render.description,
        )
        result_key = generate_object_key(
            render.organization_id, "result.jpg", prefix="renders"
        )
        # Delete old result if exists
        if render.result_image_key:
            try:
                delete_object(render.result_image_key)
            except Exception:
                pass
        upload_object(result_key, result_bytes, "image/jpeg")
        render.result_image_key = result_key
        render.status = RenderStatus.COMPLETED
    except Exception as exc:
        logger.exception("Render regeneration failed")
        render.status = RenderStatus.FAILED
        render.error_message = str(exc)[:500]

    await session.commit()
    await session.refresh(render)
    return render


async def generate_share_token(session: AsyncSession, render: Render) -> str:
    if render.share_token:
        return render.share_token

    token = secrets.token_urlsafe(32)
    render.share_token = token
    await session.commit()
    await session.refresh(render)
    return token


async def get_render_by_share_token(session: AsyncSession, token: str) -> Render | None:
    result = await session.execute(select(Render).where(Render.share_token == token))
    return result.scalar_one_or_none()
