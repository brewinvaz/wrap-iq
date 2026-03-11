"""Tests for file key validation in the onboarding submission endpoint."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.services.r2 import validate_file_keys

# ── Unit tests for validate_file_keys ────────────────────────────────

ORG_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
OTHER_ORG_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _file_key(org_id=ORG_ID, **overrides):
    defaults = {
        "r2_key": f"{org_id}/onboarding/abc123_photo.jpg",
        "filename": "photo.jpg",
        "content_type": "image/jpeg",
        "size_bytes": 1_000_000,
    }
    defaults.update(overrides)
    return defaults


class TestValidateFileKeys:
    def test_valid_single_file(self):
        validate_file_keys(ORG_ID, [_file_key()])

    def test_valid_empty_list(self):
        validate_file_keys(ORG_ID, [])

    def test_wrong_org_prefix_rejected(self):
        bad_key = _file_key(org_id=OTHER_ORG_ID)
        with pytest.raises(ValueError, match="does not belong to organization"):
            validate_file_keys(ORG_ID, [bad_key])

    def test_too_many_files_rejected(self):
        keys = [_file_key() for _ in range(6)]
        with pytest.raises(ValueError, match="Maximum 5 files"):
            validate_file_keys(ORG_ID, keys)

    def test_invalid_content_type_rejected(self):
        bad = _file_key(content_type="application/zip")
        with pytest.raises(ValueError, match="Invalid content type"):
            validate_file_keys(ORG_ID, [bad])

    def test_file_too_large_rejected(self):
        big = _file_key(size_bytes=11 * 1024 * 1024)
        with pytest.raises(ValueError, match="File too large"):
            validate_file_keys(ORG_ID, [big])

    def test_mixed_valid_and_invalid_org(self):
        keys = [_file_key(), _file_key(org_id=OTHER_ORG_ID)]
        with pytest.raises(ValueError, match="does not belong to organization"):
            validate_file_keys(ORG_ID, keys)

    def test_five_files_allowed(self):
        keys = [_file_key() for _ in range(5)]
        validate_file_keys(ORG_ID, keys)


# ── Integration tests for submit_onboarding endpoint ────────────────


@pytest.fixture
def mock_invite():
    invite = AsyncMock()
    invite.organization_id = ORG_ID
    invite.email = "client@example.com"
    return invite


@pytest.fixture
def valid_submission_body():
    return {
        "first_name": "Jane",
        "last_name": "Doe",
        "phone": "555-0100",
        "vehicle": {"vin": "1HGBH41JXMN109186"},
        "job_type": "personal",
        "file_keys": [
            {
                "r2_key": f"{ORG_ID}/onboarding/abc_photo.jpg",
                "filename": "photo.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 500_000,
            }
        ],
    }


async def test_submit_rejects_cross_org_file_key(client, mock_invite):
    """File keys from another org should be rejected with 400."""
    body = {
        "first_name": "Jane",
        "last_name": "Doe",
        "vehicle": {"vin": "1HGBH41JXMN109186"},
        "file_keys": [
            {
                "r2_key": f"{OTHER_ORG_ID}/onboarding/abc_photo.jpg",
                "filename": "photo.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 500_000,
            }
        ],
    }
    with patch(
        "app.routers.onboarding._get_valid_invite",
        new_callable=AsyncMock,
        return_value=mock_invite,
    ):
        resp = await client.post("/api/portal/onboarding/fake-token/submit", json=body)

    assert resp.status_code == 400
    assert "does not belong to organization" in resp.json()["detail"]


async def test_submit_rejects_too_many_files(client, mock_invite):
    """More than 5 files should be rejected with 400."""
    keys = [
        {
            "r2_key": f"{ORG_ID}/onboarding/{i}_photo.jpg",
            "filename": f"photo{i}.jpg",
            "content_type": "image/jpeg",
            "size_bytes": 100_000,
        }
        for i in range(6)
    ]
    body = {
        "first_name": "Jane",
        "last_name": "Doe",
        "vehicle": {"vin": "1HGBH41JXMN109186"},
        "file_keys": keys,
    }
    with patch(
        "app.routers.onboarding._get_valid_invite",
        new_callable=AsyncMock,
        return_value=mock_invite,
    ):
        resp = await client.post("/api/portal/onboarding/fake-token/submit", json=body)

    assert resp.status_code == 400
    assert "Maximum 5 files" in resp.json()["detail"]


async def test_submit_accepts_valid_file_keys(
    client, mock_invite, valid_submission_body
):
    """Valid file keys should pass validation and proceed to service."""
    mock_result = {
        "work_order_id": uuid.uuid4(),
        "job_number": "WO-001",
    }
    with (
        patch(
            "app.routers.onboarding._get_valid_invite",
            new_callable=AsyncMock,
            return_value=mock_invite,
        ),
        patch(
            "app.routers.onboarding.OnboardingService",
        ) as mock_svc_cls,
        patch(
            "app.routers.onboarding.send_magic_link_email",
            new_callable=AsyncMock,
        ),
        patch(
            "app.services.auth.AuthService.request_magic_link",
            new_callable=AsyncMock,
            return_value="magic-token",
        ),
    ):
        mock_svc = mock_svc_cls.return_value
        mock_svc.submit_onboarding = AsyncMock(return_value=mock_result)
        resp = await client.post(
            "/api/portal/onboarding/fake-token/submit",
            json=valid_submission_body,
        )

    assert resp.status_code == 200
    assert resp.json()["job_number"] == "WO-001"
