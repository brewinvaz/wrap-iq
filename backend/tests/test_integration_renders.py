from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.render import RenderStatus
from app.services import renders as render_service
from app.worker import render_generate


class TestRenderIntegration:
    async def test_create_then_worker_completes_render(
        self, setup_db, db_session, seed_org_and_user
    ):
        """Full flow: create_render enqueues → render_generate completes."""
        org, user = seed_org_and_user

        # Step 1: create_render (with mocked ARQ pool to capture args)
        mock_pool = AsyncMock()
        with patch(
            "app.services.renders.get_arq_pool", new_callable=AsyncMock
        ) as mock_get_pool:
            mock_get_pool.return_value = mock_pool

            render = await render_service.create_render(
                session=db_session,
                user=user,
                design_name="Integration Test",
                description="Full wrap",
                vehicle_photo_key=f"{org.id}/renders/photo.jpg",
                wrap_design_key=f"{org.id}/renders/design.png",
                work_order_id=None,
                client_id=None,
                vehicle_id=None,
            )

        # Verify PENDING and job was enqueued
        assert render.status == RenderStatus.PENDING
        mock_pool.enqueue_job.assert_called_once()
        enqueued_render_id = mock_pool.enqueue_job.call_args.args[1]

        # Step 2: simulate worker picking up the job
        ctx = {"session_factory": async_sessionmaker(setup_db, expire_on_commit=False)}

        with (
            patch("app.worker.generate_image", new_callable=AsyncMock) as mock_gen,
            patch("app.worker.upload_object"),
            patch("app.worker.generate_object_key") as mock_key,
        ):
            mock_gen.return_value = b"result-image-bytes"
            mock_key.return_value = f"{org.id}/renders/result.jpg"

            await render_generate(ctx, enqueued_render_id)

        # Step 3: verify final state
        await db_session.refresh(render)
        assert render.status == RenderStatus.COMPLETED
        assert render.result_image_key == f"{org.id}/renders/result.jpg"
        assert render.error_message is None
