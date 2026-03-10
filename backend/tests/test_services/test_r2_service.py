import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.r2 import (
    MAX_FILES_PER_SUBMISSION,
    generate_object_key,
    generate_upload_url,
    validate_file_keys,
)


def test_generate_object_key():
    org_id = uuid.uuid4()
    key = generate_object_key(org_id, "photo.jpg")
    assert key.startswith(f"{org_id}/onboarding/")
    assert key.endswith("_photo.jpg")


def test_generate_object_key_sanitizes_path():
    org_id = uuid.uuid4()
    key = generate_object_key(org_id, "../../etc/passwd")
    assert ".." not in key


def test_validate_file_keys_valid():
    org_id = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{org_id}/onboarding/abc_photo.jpg",
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
        }
    ]
    validate_file_keys(org_id, keys)  # Should not raise


def test_validate_file_keys_wrong_org():
    org_id = uuid.uuid4()
    other_org = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{other_org}/onboarding/abc_photo.jpg",
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
        }
    ]
    with pytest.raises(ValueError, match="does not belong"):
        validate_file_keys(org_id, keys)


def test_validate_file_keys_too_many():
    org_id = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{org_id}/onboarding/{i}_photo.jpg",
            "filename": "photo.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
        }
        for i in range(MAX_FILES_PER_SUBMISSION + 1)
    ]
    with pytest.raises(ValueError, match="Maximum"):
        validate_file_keys(org_id, keys)


def test_validate_file_keys_bad_content_type():
    org_id = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{org_id}/onboarding/abc_file.exe",
            "filename": "file.exe",
            "content_type": "application/x-executable",
            "size_bytes": 1024,
        }
    ]
    with pytest.raises(ValueError, match="Invalid content type"):
        validate_file_keys(org_id, keys)


def test_validate_file_keys_too_large():
    org_id = uuid.uuid4()
    keys = [
        {
            "r2_key": f"{org_id}/onboarding/abc_big.jpg",
            "filename": "big.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 11 * 1024 * 1024,
        }
    ]
    with pytest.raises(ValueError, match="File too large"):
        validate_file_keys(org_id, keys)


@patch("app.services.r2._get_client")
def test_generate_upload_url(mock_get_client):
    mock_client = MagicMock()
    mock_client.generate_presigned_url.return_value = "https://r2.example.com/signed"
    mock_get_client.return_value = mock_client

    url = generate_upload_url("key/file.jpg", "image/jpeg")
    assert url == "https://r2.example.com/signed"
    mock_client.generate_presigned_url.assert_called_once()


def test_generate_upload_url_rejects_bad_type():
    with pytest.raises(ValueError, match="Content type not allowed"):
        generate_upload_url("key/file.exe", "application/x-executable")
