"""Tests for work order photo endpoints."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_session
from app.main import app
from app.models.file_upload import FileUpload
from app.models.user import User

ORG_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
WORK_ORDER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
PHOTO_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")

BASE_URL = f"/api/work-orders/{WORK_ORDER_ID}/photos"


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = USER_ID
    user.organization_id = ORG_ID
    user.is_active = True
    return user


@pytest.fixture
def mock_session():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
async def client(mock_user, mock_session):
    async def override_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = lambda: mock_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


class TestUploadUrl:
    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    @patch(
        "app.routers.work_order_photos.generate_upload_url",
        return_value="https://r2.example.com/upload",
    )
    @patch(
        "app.routers.work_order_photos.generate_object_key",
        return_value=f"{ORG_ID}/photos/abc123_photo.jpg",
    )
    async def test_returns_presigned_url(
        self, mock_key, mock_url, mock_r2, client
    ):
        resp = await client.post(
            f"{BASE_URL}/upload-url",
            json={"filename": "photo.jpg", "content_type": "image/jpeg"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["upload_url"] == "https://r2.example.com/upload"
        assert data["r2_key"] == f"{ORG_ID}/photos/abc123_photo.jpg"

    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    async def test_rejects_pdf_content_type(self, mock_r2, client):
        resp = await client.post(
            f"{BASE_URL}/upload-url",
            json={"filename": "doc.pdf", "content_type": "application/pdf"},
        )
        assert resp.status_code == 400
        assert "image files" in resp.json()["detail"].lower()

    @patch("app.routers.work_order_photos.is_r2_configured", return_value=False)
    async def test_returns_503_when_r2_not_configured(self, mock_r2, client):
        resp = await client.post(
            f"{BASE_URL}/upload-url",
            json={"filename": "photo.jpg", "content_type": "image/jpeg"},
        )
        assert resp.status_code == 503


class TestRegisterPhotos:
    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    @patch("app.routers.work_order_photos.validate_file_keys")
    @patch(
        "app.routers.work_order_photos.generate_download_url",
        return_value="https://r2.example.com/download",
    )
    async def test_registers_photos_successfully(
        self, mock_download, mock_validate, mock_r2, client, mock_session
    ):
        now = datetime.now(tz=timezone.utc)

        # Patch commit to set timestamps on FileUpload objects added to session
        added_objects: list[FileUpload] = []
        original_add = mock_session.add

        def capture_add(obj):
            added_objects.append(obj)
            # Set fields that would be set by DB defaults
            if not obj.id:
                obj.id = uuid.uuid4()
            obj.created_at = now
            obj.updated_at = now
            return original_add(obj)

        mock_session.add = capture_add

        r2_key = f"{ORG_ID}/photos/abc123_photo.jpg"
        resp = await client.post(
            BASE_URL,
            json={
                "files": [
                    {
                        "r2_key": r2_key,
                        "filename": "photo.jpg",
                        "content_type": "image/jpeg",
                        "size_bytes": 12345,
                    }
                ]
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 1
        assert data[0]["filename"] == "photo.jpg"
        assert data[0]["url"] == "https://r2.example.com/download"

    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    async def test_rejects_pdf_in_register(self, mock_r2, client):
        resp = await client.post(
            BASE_URL,
            json={
                "files": [
                    {
                        "r2_key": f"{ORG_ID}/photos/doc.pdf",
                        "filename": "doc.pdf",
                        "content_type": "application/pdf",
                        "size_bytes": 5000,
                    }
                ]
            },
        )
        assert resp.status_code == 400

    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    @patch(
        "app.routers.work_order_photos.validate_file_keys",
        side_effect=ValueError("Invalid file key: does not belong to organization"),
    )
    async def test_rejects_cross_org_keys(
        self, mock_validate, mock_r2, client
    ):
        other_org = uuid.uuid4()
        resp = await client.post(
            BASE_URL,
            json={
                "files": [
                    {
                        "r2_key": f"{other_org}/photos/photo.jpg",
                        "filename": "photo.jpg",
                        "content_type": "image/jpeg",
                        "size_bytes": 5000,
                    }
                ]
            },
        )
        assert resp.status_code == 400
        assert "organization" in resp.json()["detail"].lower()

    @patch("app.routers.work_order_photos.is_r2_configured", return_value=False)
    async def test_returns_503_when_r2_not_configured(self, mock_r2, client):
        resp = await client.post(
            BASE_URL,
            json={
                "files": [
                    {
                        "r2_key": f"{ORG_ID}/photos/photo.jpg",
                        "filename": "photo.jpg",
                        "content_type": "image/jpeg",
                        "size_bytes": 5000,
                    }
                ]
            },
        )
        assert resp.status_code == 503


class TestListPhotos:
    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    async def test_returns_empty_list(self, mock_r2, client, mock_session):
        # Mock the query result to return empty list
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute.return_value = mock_result

        resp = await client.get(BASE_URL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["photos"] == []


class TestUpdatePhoto:
    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    @patch(
        "app.routers.work_order_photos.generate_download_url",
        return_value="https://r2.example.com/download",
    )
    async def test_update_photo_type(
        self, mock_download, mock_r2, client, mock_session
    ):
        now = datetime.now(tz=timezone.utc)
        upload = MagicMock(spec=FileUpload)
        upload.id = PHOTO_ID
        upload.filename = "photo.jpg"
        upload.content_type = "image/jpeg"
        upload.size_bytes = 12345
        upload.photo_type = None
        upload.caption = None
        upload.r2_key = f"{ORG_ID}/photos/abc_photo.jpg"
        upload.created_at = now

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = upload
        mock_session.execute.return_value = mock_result

        resp = await client.patch(
            f"{BASE_URL}/{PHOTO_ID}",
            json={"photo_type": "before"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(PHOTO_ID)

    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    async def test_returns_404_for_missing_photo(
        self, mock_r2, client, mock_session
    ):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        resp = await client.patch(
            f"{BASE_URL}/{PHOTO_ID}",
            json={"photo_type": "after"},
        )
        assert resp.status_code == 404


class TestDeletePhoto:
    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    @patch("app.routers.work_order_photos.delete_object")
    async def test_deletes_photo(
        self, mock_delete, mock_r2, client, mock_session
    ):
        upload = MagicMock(spec=FileUpload)
        upload.id = PHOTO_ID
        upload.r2_key = f"{ORG_ID}/photos/abc_photo.jpg"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = upload
        mock_session.execute.return_value = mock_result

        resp = await client.delete(f"{BASE_URL}/{PHOTO_ID}")
        assert resp.status_code == 204
        mock_delete.assert_called_once_with(upload.r2_key)
        mock_session.delete.assert_called_once_with(upload)

    @patch("app.routers.work_order_photos.is_r2_configured", return_value=True)
    async def test_returns_404_for_missing_photo(
        self, mock_r2, client, mock_session
    ):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        resp = await client.delete(f"{BASE_URL}/{PHOTO_ID}")
        assert resp.status_code == 404
