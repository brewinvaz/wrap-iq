import uuid

import boto3
from botocore.config import Config

from app.config import settings

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}
MAX_FILE_SIZE_MB = 10
MAX_FILES_PER_SUBMISSION = 5


def is_r2_configured() -> bool:
    """Check whether R2 credentials are present."""
    return bool(
        settings.r2_account_id
        and settings.r2_access_key_id
        and settings.r2_secret_access_key
    )


def _get_client():
    if not is_r2_configured():
        raise RuntimeError(
            "Cloudflare R2 is not configured. "
            "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY."
        )
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def generate_object_key(org_id: uuid.UUID, filename: str) -> str:
    safe_filename = filename.replace("/", "_").replace("\\", "_").replace("..", "")
    unique = uuid.uuid4().hex[:8]
    return f"{org_id}/onboarding/{unique}_{safe_filename}"


def generate_upload_url(key: str, content_type: str, expires_in: int = 900) -> str:
    """Generate a presigned PUT URL for uploading to R2. Expires in 15 minutes."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Content type not allowed: {content_type}")

    client = _get_client()
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )
    return url


def generate_download_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned GET URL for downloading from R2. Expires in 1 hour."""
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": key,
        },
        ExpiresIn=expires_in,
    )


def delete_object(key: str) -> None:
    """Delete an object from R2."""
    client = _get_client()
    client.delete_object(Bucket=settings.r2_bucket_name, Key=key)


def validate_file_keys(
    org_id: uuid.UUID,
    file_keys: list[dict],
) -> None:
    """Validate file keys belong to the org namespace and meet constraints."""
    if len(file_keys) > MAX_FILES_PER_SUBMISSION:
        raise ValueError(f"Maximum {MAX_FILES_PER_SUBMISSION} files per submission")

    org_prefix = str(org_id) + "/"
    for fk in file_keys:
        if not fk["r2_key"].startswith(org_prefix):
            raise ValueError("Invalid file key: does not belong to organization")
        if fk["content_type"] not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Invalid content type: {fk['content_type']}")
        if fk["size_bytes"] > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise ValueError(f"File too large: max {MAX_FILE_SIZE_MB}MB")
