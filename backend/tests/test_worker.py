from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.render import Render, RenderStatus
from app.worker import render_generate, send_email, shutdown, startup


class TestWorkerLifecycle:
    async def test_startup_creates_session_factory(self):
        ctx = {}
        with (
            patch("app.worker.create_async_engine") as mock_engine,
            patch("app.worker.async_sessionmaker") as mock_session,
        ):
            mock_engine.return_value = MagicMock()
            mock_session.return_value = MagicMock()

            await startup(ctx)

            assert "session_factory" in ctx
            assert "engine" in ctx
            mock_engine.assert_called_once()

    async def test_shutdown_disposes_engine(self):
        mock_engine = AsyncMock()
        ctx = {"engine": mock_engine}

        await shutdown(ctx)

        mock_engine.dispose.assert_called_once()


class TestRenderGenerateTask:
    async def test_successful_render(self, setup_db, db_session, seed_org_and_user):
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            created_by=user.id,
            status=RenderStatus.PENDING,
        )
        db_session.add(render)
        await db_session.commit()
        render_id = render.id

        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with (
            patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen,
            patch("app.worker.upload_object"),
            patch("app.worker.generate_object_key") as mock_key,
        ):
            mock_gen.return_value = b"result-image"
            mock_key.return_value = f"{org.id}/renders/result.jpg"

            await render_generate(ctx, str(render_id))

        await db_session.refresh(render)
        assert render.status == RenderStatus.COMPLETED
        assert render.result_image_key is not None

    async def test_failed_render(self, setup_db, db_session, seed_org_and_user):
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            created_by=user.id,
            status=RenderStatus.PENDING,
        )
        db_session.add(render)
        await db_session.commit()
        render_id = render.id

        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = RuntimeError("Gemini API error")
            await render_generate(ctx, str(render_id))

        await db_session.refresh(render)
        assert render.status == RenderStatus.FAILED
        assert "Gemini API error" in render.error_message

    async def test_skips_if_already_rendering(
        self, setup_db, db_session, seed_org_and_user
    ):
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            created_by=user.id,
            status=RenderStatus.RENDERING,
        )
        db_session.add(render)
        await db_session.commit()
        render_id = render.id

        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen:
            await render_generate(ctx, str(render_id))
            mock_gen.assert_not_called()

    async def test_delete_old_on_regenerate(
        self, setup_db, db_session, seed_org_and_user
    ):
        org, user = seed_org_and_user
        render = Render(
            organization_id=org.id,
            design_name="Test",
            vehicle_photo_key=f"{org.id}/renders/photo.jpg",
            wrap_design_key=f"{org.id}/renders/design.png",
            result_image_key=f"{org.id}/renders/old_result.jpg",
            created_by=user.id,
            status=RenderStatus.PENDING,
        )
        db_session.add(render)
        await db_session.commit()
        render_id = render.id

        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with (
            patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen,
            patch("app.worker.upload_object"),
            patch("app.worker.generate_object_key") as mock_key,
            patch("app.worker.delete_object") as mock_delete,
        ):
            mock_gen.return_value = b"new-result"
            mock_key.return_value = f"{org.id}/renders/new_result.jpg"

            await render_generate(ctx, str(render_id), delete_old=True)

        mock_delete.assert_called_once_with(f"{org.id}/renders/old_result.jpg")


class TestSendEmailTask:
    @patch("app.worker.resend")
    @patch("app.worker.settings")
    async def test_sends_magic_link(self, mock_settings, mock_resend):
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.frontend_url = "https://app.example.com"
        mock_settings.email_from = "noreply@example.com"

        await send_email(
            ctx={},
            email_type="magic_link",
            to_email="user@test.com",
            token="abc123",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == ["user@test.com"]
        assert "abc123" in call_args["html"]
        assert "https://app.example.com/auth/magic-link" in call_args["html"]

    @patch("app.worker.resend")
    @patch("app.worker.settings")
    async def test_sends_onboarding_invite(self, mock_settings, mock_resend):
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.frontend_url = "https://app.example.com"
        mock_settings.email_from = "noreply@example.com"

        await send_email(
            ctx={},
            email_type="onboarding_invite",
            to_email="client@test.com",
            token="def456",
            org_name="Test Wraps Co",
        )

        mock_resend.Emails.send.assert_called_once()
        call_args = mock_resend.Emails.send.call_args[0][0]
        assert call_args["to"] == ["client@test.com"]
        assert "Test Wraps Co" in call_args["html"]
        assert "https://app.example.com/onboard" in call_args["html"]

    @patch("app.worker.resend")
    @patch("app.worker.settings")
    async def test_unknown_email_type_raises(self, mock_settings, mock_resend):
        mock_settings.resend_api_key = "re_test_key"
        with pytest.raises(ValueError, match="Unknown email type"):
            await send_email(
                ctx={}, email_type="unknown", to_email="a@b.com", token="x"
            )
