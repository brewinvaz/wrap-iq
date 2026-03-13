from unittest.mock import AsyncMock, patch

from app.services.arq import close_arq_pool, get_arq_pool


class TestGetArqPool:
    async def test_returns_pool(self):
        with patch(
            "app.services.arq.create_pool", new_callable=AsyncMock
        ) as mock_create:
            mock_pool = AsyncMock()
            mock_create.return_value = mock_pool

            import app.services.arq as arq_mod

            arq_mod._arq_pool = None

            pool = await get_arq_pool()
            assert pool is mock_pool
            mock_create.assert_called_once()

    async def test_returns_same_pool_on_second_call(self):
        with patch(
            "app.services.arq.create_pool", new_callable=AsyncMock
        ) as mock_create:
            mock_pool = AsyncMock()
            mock_create.return_value = mock_pool

            import app.services.arq as arq_mod

            arq_mod._arq_pool = None

            pool1 = await get_arq_pool()
            pool2 = await get_arq_pool()
            assert pool1 is pool2
            mock_create.assert_called_once()


class TestCloseArqPool:
    async def test_closes_pool(self):
        import app.services.arq as arq_mod

        mock_pool = AsyncMock()
        arq_mod._arq_pool = mock_pool

        await close_arq_pool()
        mock_pool.aclose.assert_called_once()
        assert arq_mod._arq_pool is None

    async def test_noop_when_no_pool(self):
        import app.services.arq as arq_mod

        arq_mod._arq_pool = None

        await close_arq_pool()  # should not raise
