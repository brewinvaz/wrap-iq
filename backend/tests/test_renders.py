import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.r2 import (
    download_object,
    generate_object_key,
    upload_object,
)


# Override the autouse setup_db fixture so these unit tests don't need a DB connection.
@pytest.fixture(autouse=True)
def setup_db():
    yield None


class TestGenerateObjectKey:
    def test_renders_prefix(self):
        org_id = uuid.uuid4()
        key = generate_object_key(org_id, "photo.jpg", prefix="renders")
        assert key.startswith(f"{org_id}/renders/")
        assert key.endswith("_photo.jpg")

    def test_default_prefix_is_onboarding(self):
        org_id = uuid.uuid4()
        key = generate_object_key(org_id, "file.pdf")
        assert f"{org_id}/onboarding/" in key

    def test_sanitizes_filename(self):
        org_id = uuid.uuid4()
        key = generate_object_key(org_id, "../etc/passwd", prefix="renders")
        assert ".." not in key
        suffix = key.split("/renders/")[1]
        # suffix should be "{unique}_etcpasswd" — no slashes
        assert suffix.count("/") == 0


class TestUploadObject:
    @patch("app.services.r2._get_client")
    def test_upload_object_calls_put(self, mock_get_client):
        mock_s3 = MagicMock()
        mock_get_client.return_value = mock_s3
        upload_object("org/renders/test.jpg", b"image-data", "image/jpeg")
        mock_s3.put_object.assert_called_once()
        call_kwargs = mock_s3.put_object.call_args[1]
        assert call_kwargs["Bucket"] is not None
        assert call_kwargs["Key"] == "org/renders/test.jpg"
        assert call_kwargs["Body"] == b"image-data"
        assert call_kwargs["ContentType"] == "image/jpeg"


class TestDownloadObject:
    @patch("app.services.r2._get_client")
    def test_download_object_returns_bytes(self, mock_get_client):
        mock_s3 = MagicMock()
        mock_body = MagicMock()
        mock_body.read.return_value = b"image-bytes"
        mock_s3.get_object.return_value = {"Body": mock_body}
        mock_get_client.return_value = mock_s3
        result = download_object("org/renders/test.jpg")
        assert result == b"image-bytes"
        call_kwargs = mock_s3.get_object.call_args[1]
        assert call_kwargs["Bucket"] is not None
        assert call_kwargs["Key"] == "org/renders/test.jpg"
