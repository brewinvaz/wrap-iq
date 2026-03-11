import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.schemas.renders import FileInfo, RenderCreate, RenderUploadRequest
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


class TestRenderSchemas:
    def test_render_create_valid(self):
        data = RenderCreate(
            design_name="Test Wrap",
            vehicle_photo_key="org/renders/abc_photo.jpg",
            wrap_design_key="org/renders/def_design.png",
        )
        assert data.design_name == "Test Wrap"
        assert data.work_order_id is None

    def test_render_create_missing_design_name(self):
        with pytest.raises(Exception):
            RenderCreate(
                design_name="",
                vehicle_photo_key="key1",
                wrap_design_key="key2",
            )

    def test_upload_request_max_two_files(self):
        with pytest.raises(Exception):
            RenderUploadRequest(
                files=[
                    FileInfo(filename="a.jpg", content_type="image/jpeg", size_bytes=100),
                    FileInfo(filename="b.jpg", content_type="image/jpeg", size_bytes=100),
                    FileInfo(filename="c.jpg", content_type="image/jpeg", size_bytes=100),
                ]
            )

    def test_upload_request_validates_content_type(self):
        with pytest.raises(Exception):
            RenderUploadRequest(
                files=[
                    FileInfo(filename="a.exe", content_type="application/exe", size_bytes=100),
                ]
            )

    def test_upload_request_validates_file_size(self):
        with pytest.raises(Exception):
            RenderUploadRequest(
                files=[
                    FileInfo(
                        filename="huge.jpg",
                        content_type="image/jpeg",
                        size_bytes=11 * 1024 * 1024,
                    ),
                ]
            )
