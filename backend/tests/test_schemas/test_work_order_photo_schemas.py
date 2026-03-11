"""Tests for work order photo schemas."""

import uuid

import pytest
from pydantic import ValidationError

from app.schemas.work_order_photos import (
    PhotoRegisterFile,
    PhotoRegisterRequest,
    PhotoUpdateRequest,
    PhotoUploadUrlRequest,
)


class TestPhotoUploadUrlRequest:
    def test_valid_jpeg(self):
        req = PhotoUploadUrlRequest(filename="test.jpg", content_type="image/jpeg")
        assert req.filename == "test.jpg"

    def test_valid_png(self):
        req = PhotoUploadUrlRequest(filename="test.png", content_type="image/png")
        assert req.content_type == "image/png"

    def test_valid_webp(self):
        req = PhotoUploadUrlRequest(filename="test.webp", content_type="image/webp")
        assert req.content_type == "image/webp"


class TestPhotoRegisterRequest:
    def test_valid_single_file(self):
        req = PhotoRegisterRequest(
            files=[
                PhotoRegisterFile(
                    r2_key="org-id/photos/abc_test.jpg",
                    filename="test.jpg",
                    content_type="image/jpeg",
                    size_bytes=1_000_000,
                )
            ]
        )
        assert len(req.files) == 1

    def test_max_five_files(self):
        files = [
            PhotoRegisterFile(
                r2_key=f"org-id/photos/{i}_test.jpg",
                filename=f"test{i}.jpg",
                content_type="image/jpeg",
                size_bytes=100_000,
            )
            for i in range(5)
        ]
        req = PhotoRegisterRequest(files=files)
        assert len(req.files) == 5

    def test_rejects_more_than_five_files(self):
        files = [
            PhotoRegisterFile(
                r2_key=f"org-id/photos/{i}_test.jpg",
                filename=f"test{i}.jpg",
                content_type="image/jpeg",
                size_bytes=100_000,
            )
            for i in range(6)
        ]
        with pytest.raises(ValidationError, match="at most 5"):
            PhotoRegisterRequest(files=files)

    def test_rejects_empty_files(self):
        with pytest.raises(ValidationError, match="at least 1"):
            PhotoRegisterRequest(files=[])


class TestPhotoUpdateRequest:
    def test_valid_before_type(self):
        req = PhotoUpdateRequest(photo_type="before")
        assert req.photo_type == "before"

    def test_valid_after_type(self):
        req = PhotoUpdateRequest(photo_type="after")
        assert req.photo_type == "after"

    def test_null_type_for_uncategorized(self):
        req = PhotoUpdateRequest(photo_type=None)
        assert req.photo_type is None

    def test_valid_caption(self):
        req = PhotoUpdateRequest(caption="Front bumper")
        assert req.caption == "Front bumper"

    def test_rejects_caption_over_500_chars(self):
        with pytest.raises(ValidationError):
            PhotoUpdateRequest(caption="x" * 501)

    def test_rejects_invalid_photo_type(self):
        with pytest.raises(ValidationError):
            PhotoUpdateRequest(photo_type="invalid")
