import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.vehicle_detection import detect_vehicle_from_image


def _mock_response(text: str):
    """Build a mock Gemini response with the given text content."""
    response = MagicMock()
    response.text = text
    return response


def _detection_json(**overrides):
    """Build a valid detection JSON string."""
    data = {
        "year": 2023,
        "make": "Toyota",
        "model": "Camry",
        "vehicle_type": "car",
        "color": "white",
        "confidence": 0.92,
        "suggestions": [
            {"year": 2022, "make": "Toyota", "model": "Camry", "confidence": 0.75}
        ],
    }
    data.update(overrides)
    return json.dumps(data)


@pytest.fixture(autouse=True)
def _set_api_key():
    with patch("app.services.vehicle_detection.settings") as mock_settings:
        mock_settings.gemini_api_key = "test-key"
        yield mock_settings


async def test_detect_vehicle_success(_set_api_key):
    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(
        _detection_json()
    )
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.vehicle_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_vehicle_from_image(b"fake-image", "image/jpeg")

    assert result.year == 2023
    assert result.make == "Toyota"
    assert result.model == "Camry"
    assert result.vehicle_type == "car"
    assert result.color == "white"
    assert result.confidence == pytest.approx(0.92)
    assert len(result.suggestions) == 1
    assert result.suggestions[0].year == 2022


async def test_detect_vehicle_suv(_set_api_key):
    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(
        _detection_json(
            make="Ford",
            model="Explorer",
            vehicle_type="suv",
            color="black",
            confidence=0.88,
        )
    )
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.vehicle_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_vehicle_from_image(b"fake-image", "image/png")

    assert result.vehicle_type == "suv"
    assert result.make == "Ford"


async def test_detect_vehicle_pickup(_set_api_key):
    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(
        _detection_json(
            make="Ford",
            model="F-150",
            vehicle_type="pickup",
            confidence=0.85,
        )
    )
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.vehicle_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_vehicle_from_image(b"fake-image", "image/jpeg")

    assert result.vehicle_type == "pickup"


async def test_detect_vehicle_van(_set_api_key):
    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(
        _detection_json(
            make="Mercedes-Benz",
            model="Sprinter",
            vehicle_type="utility_van",
            confidence=0.90,
        )
    )
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.vehicle_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_vehicle_from_image(b"fake-image", "image/webp")

    assert result.vehicle_type == "utility_van"


async def test_detect_vehicle_api_error(_set_api_key):
    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.side_effect = Exception("API Error")
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with (
        patch(
            "app.services.vehicle_detection.genai.Client",
            return_value=mock_client,
        ),
        pytest.raises(Exception, match="API Error"),
    ):
        await detect_vehicle_from_image(b"fake-image", "image/jpeg")


async def test_detect_vehicle_invalid_json(_set_api_key):
    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(
        "I cannot parse this image properly"
    )
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.vehicle_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_vehicle_from_image(b"fake-image", "image/jpeg")

    assert result.confidence == 0.0
    assert result.year is None
    assert result.make is None


async def test_detect_vehicle_empty_api_key():
    with patch("app.services.vehicle_detection.settings") as mock_settings:
        mock_settings.gemini_api_key = ""

        with pytest.raises(RuntimeError, match="AI features are not configured"):
            await detect_vehicle_from_image(b"fake-image", "image/jpeg")


async def test_detect_vehicle_unknown_vehicle_type(_set_api_key):
    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(
        _detection_json(vehicle_type="spaceship")
    )
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.vehicle_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_vehicle_from_image(b"fake-image", "image/jpeg")

    assert result.vehicle_type is None
    assert result.year == 2023
