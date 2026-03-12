"""Work order photo management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.models.file_upload import FileUpload
from app.models.user import User
from app.schemas.work_order_photos import (
    PhotoListResponse,
    PhotoRegisterRequest,
    PhotoResponse,
    PhotoUpdateRequest,
    PhotoUploadUrlRequest,
    PhotoUploadUrlResponse,
)
from app.services.r2 import (
    delete_object,
    generate_download_url,
    generate_object_key,
    generate_upload_url,
    is_r2_configured,
    validate_file_keys,
)

router = APIRouter(
    prefix="/api/work-orders/{work_order_id}/photos",
    tags=["work-order-photos"],
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _check_r2():
    if not is_r2_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File storage not configured",
        )


@router.post("/upload-url", response_model=PhotoUploadUrlResponse)
async def get_photo_upload_url(
    work_order_id: uuid.UUID,
    body: PhotoUploadUrlRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Generate a presigned R2 upload URL for a photo."""
    _check_r2()

    if body.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only image files allowed. Accepted types: "
                f"{', '.join(sorted(ALLOWED_IMAGE_TYPES))}"
            ),
        )

    try:
        r2_key = generate_object_key(
            user.organization_id, body.filename, prefix="photos"
        )
        url = generate_upload_url(r2_key, body.content_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {"upload_url": url, "r2_key": r2_key}


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=list[PhotoResponse]
)
async def register_photos(
    work_order_id: uuid.UUID,
    body: PhotoRegisterRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Register photos that have been uploaded to R2."""
    _check_r2()

    for f in body.files:
        if f.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only image files allowed. Got: {f.content_type}",
            )

    file_key_dicts = [f.model_dump() for f in body.files]
    try:
        validate_file_keys(user.organization_id, file_key_dicts)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    created = []
    for f in body.files:
        upload = FileUpload(
            uploaded_by=user.id,
            organization_id=user.organization_id,
            work_order_id=work_order_id,
            r2_key=f.r2_key,
            filename=f.filename,
            content_type=f.content_type,
            size_bytes=f.size_bytes,
        )
        session.add(upload)
        created.append(upload)

    await session.commit()

    photos = []
    for upload in created:
        url = generate_download_url(upload.r2_key)
        photos.append(
            PhotoResponse(
                id=upload.id,
                filename=upload.filename,
                content_type=upload.content_type,
                size_bytes=upload.size_bytes,
                photo_type=upload.photo_type,
                caption=upload.caption,
                url=url,
                created_at=upload.created_at,
            )
        )

    return photos


@router.get("", response_model=PhotoListResponse)
async def list_photos(
    work_order_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all photos for a work order."""
    _check_r2()

    result = await session.execute(
        select(FileUpload)
        .where(
            FileUpload.work_order_id == work_order_id,
            FileUpload.organization_id == user.organization_id,
            FileUpload.content_type.in_(ALLOWED_IMAGE_TYPES),
        )
        .order_by(FileUpload.created_at)
    )
    uploads = result.scalars().all()

    photos = []
    for upload in uploads:
        url = generate_download_url(upload.r2_key)
        photos.append(
            PhotoResponse(
                id=upload.id,
                filename=upload.filename,
                content_type=upload.content_type,
                size_bytes=upload.size_bytes,
                photo_type=upload.photo_type,
                caption=upload.caption,
                url=url,
                created_at=upload.created_at,
            )
        )

    return {"photos": photos}


async def _get_photo_or_404(
    photo_id: uuid.UUID,
    work_order_id: uuid.UUID,
    org_id: uuid.UUID,
    session: AsyncSession,
) -> FileUpload:
    result = await session.execute(
        select(FileUpload).where(
            FileUpload.id == photo_id,
            FileUpload.work_order_id == work_order_id,
            FileUpload.organization_id == org_id,
        )
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )
    return upload


@router.patch("/{photo_id}", response_model=PhotoResponse)
async def update_photo(
    work_order_id: uuid.UUID,
    photo_id: uuid.UUID,
    body: PhotoUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update photo metadata (category, caption)."""
    _check_r2()

    upload = await _get_photo_or_404(
        photo_id, work_order_id, user.organization_id, session
    )

    if body.photo_type is not None:
        upload.photo_type = body.photo_type
    elif body.model_fields_set and "photo_type" in body.model_fields_set:
        upload.photo_type = None

    if body.caption is not None:
        upload.caption = body.caption
    elif "caption" in body.model_fields_set:
        upload.caption = None

    await session.commit()

    url = generate_download_url(upload.r2_key)
    return PhotoResponse(
        id=upload.id,
        filename=upload.filename,
        content_type=upload.content_type,
        size_bytes=upload.size_bytes,
        photo_type=upload.photo_type,
        caption=upload.caption,
        url=url,
        created_at=upload.created_at,
    )


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    work_order_id: uuid.UUID,
    photo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a photo from R2 and database."""
    _check_r2()

    upload = await _get_photo_or_404(
        photo_id, work_order_id, user.organization_id, session
    )

    delete_object(upload.r2_key)
    await session.delete(upload)
    await session.commit()
