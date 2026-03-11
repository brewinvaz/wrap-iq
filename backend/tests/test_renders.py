import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_session
from app.main import app
from app.models.plan import Plan
from app.models.render import Render, RenderStatus
from app.schemas.renders import FileInfo, RenderCreate, RenderUploadRequest
from app.services import renders as render_service
from app.services.r2 import (
    download_object,
    generate_object_key,
    upload_object,
)


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
                    FileInfo(
                        filename="a.jpg", content_type="image/jpeg", size_bytes=100
                    ),
                    FileInfo(
                        filename="b.jpg", content_type="image/jpeg", size_bytes=100
                    ),
                    FileInfo(
                        filename="c.jpg", content_type="image/jpeg", size_bytes=100
                    ),
                ]
            )

    def test_upload_request_validates_content_type(self):
        with pytest.raises(Exception):
            RenderUploadRequest(
                files=[
                    FileInfo(
                        filename="a.exe", content_type="application/exe", size_bytes=100
                    ),
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


class TestBuildRenderResponse:
    def test_builds_response_with_urls(self):
        render = MagicMock(spec=Render)
        render.id = uuid.uuid4()
        render.design_name = "Test"
        render.description = None
        render.status = RenderStatus.COMPLETED
        render.vehicle_photo_key = "org/renders/photo.jpg"
        render.wrap_design_key = "org/renders/design.png"
        render.result_image_key = "org/renders/result.jpg"
        render.share_token = None
        render.error_message = None
        render.work_order_id = None
        render.client_id = None
        render.vehicle_id = None
        render.created_by = uuid.uuid4()
        render.creator = MagicMock()
        render.creator.full_name = "Test User"
        render.creator.email = "test@test.com"
        render.created_at = "2026-03-11T00:00:00Z"
        render.updated_at = "2026-03-11T00:00:00Z"

        with patch("app.services.renders.generate_download_url") as mock_dl:
            mock_dl.side_effect = lambda key: f"https://r2.example.com/{key}"
            response = render_service.build_render_response(render)

        assert (
            response.vehicle_photo_url == "https://r2.example.com/org/renders/photo.jpg"
        )
        assert (
            response.result_image_url == "https://r2.example.com/org/renders/result.jpg"
        )
        assert response.created_by_name == "Test User"

    def test_uses_email_when_no_full_name(self):
        render = MagicMock(spec=Render)
        render.id = uuid.uuid4()
        render.design_name = "Test"
        render.description = None
        render.status = RenderStatus.PENDING
        render.vehicle_photo_key = "k1"
        render.wrap_design_key = "k2"
        render.result_image_key = None
        render.share_token = None
        render.error_message = None
        render.work_order_id = None
        render.client_id = None
        render.vehicle_id = None
        render.created_by = uuid.uuid4()
        render.creator = MagicMock()
        render.creator.full_name = None
        render.creator.email = "test@test.com"
        render.created_at = "2026-03-11T00:00:00Z"
        render.updated_at = "2026-03-11T00:00:00Z"

        with patch("app.services.renders.generate_download_url") as mock_dl:
            mock_dl.side_effect = lambda key: f"https://r2/{key}"
            response = render_service.build_render_response(render)

        assert response.created_by_name == "test@test.com"
        assert response.result_image_url is None


class TestBuildPrompt:
    def test_prompt_with_description(self):
        prompt = render_service.build_prompt("Full wrap, all panels")
        assert "Full wrap, all panels" in prompt
        assert "vehicle wrap design" in prompt.lower()

    def test_prompt_without_description(self):
        prompt = render_service.build_prompt(None)
        assert "vehicle wrap design" in prompt.lower()


class TestMimeTypeFromKey:
    def test_jpeg(self):
        assert (
            render_service._mime_type_from_key("org/renders/photo.jpg") == "image/jpeg"
        )

    def test_png(self):
        assert (
            render_service._mime_type_from_key("org/renders/design.png") == "image/png"
        )

    def test_webp(self):
        assert (
            render_service._mime_type_from_key("org/renders/photo.webp") == "image/webp"
        )

    def test_pdf(self):
        assert (
            render_service._mime_type_from_key("org/renders/design.pdf")
            == "application/pdf"
        )

    def test_default_jpeg(self):
        assert render_service._mime_type_from_key("org/renders/unknown") == "image/jpeg"


@pytest.fixture
async def seed_plan(db_session):
    plan = Plan(id=uuid.uuid4(), name="Free", price_cents=0, is_default=True)
    db_session.add(plan)
    await db_session.commit()
    return plan


@pytest.fixture
async def http_client(db_session, seed_plan):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _register(http_client) -> str:
    resp = await http_client.post(
        "/api/auth/register",
        json={
            "email": "staff@shop.com",
            "password": "TestPass123",
            "org_name": "Test Shop",
        },
    )
    return resp.json()["access_token"]


class TestRendersRouter:
    async def test_list_requires_auth(self, http_client):
        resp = await http_client.get("/api/renders")
        assert resp.status_code == 401

    async def test_list_empty(self, http_client):
        token = await _register(http_client)
        resp = await http_client.get(
            "/api/renders",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_get_nonexistent_returns_404(self, http_client):
        token = await _register(http_client)
        fake_id = str(uuid.uuid4())
        resp = await http_client.get(
            f"/api/renders/{fake_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    async def test_upload_urls_validates_content_type(self, http_client):
        token = await _register(http_client)
        resp = await http_client.post(
            "/api/renders/upload-urls",
            json={
                "files": [
                    {
                        "filename": "bad.exe",
                        "content_type": "application/exe",
                        "size_bytes": 100,
                    }
                ]
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
