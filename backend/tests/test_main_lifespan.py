from unittest.mock import AsyncMock, patch

from app.main import app, lifespan


class TestLifespan:
    async def test_lifespan_closes_arq_pool_on_shutdown(self):
        """Lifespan should call close_arq_pool during shutdown."""
        with patch("app.main.close_arq_pool", new_callable=AsyncMock) as mock_close:
            async with lifespan(app):
                pass
            mock_close.assert_called_once()
