import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.discrepancy_detection import detect_discrepancies


def _mock_response(text: str):
    response = MagicMock()
    response.text = text
    return response


def _discrepancy_json(**overrides):
    data = {
        "match_confidence": 0.95,
        "image_analysis_summary": "White Toyota Camry sedan",
        "detected_make": "Toyota",
        "detected_model": "Camry",
        "detected_color": "white",
        "detected_vehicle_type": "car",
        "discrepancies": [],
    }
    data.update(overrides)
    return json.dumps(data)


def _mock_vehicle(**overrides):
    vehicle = MagicMock()
    vehicle.id = overrides.get("id", uuid.uuid4())
    vehicle.organization_id = overrides.get("organization_id", uuid.uuid4())
    vehicle.make = overrides.get("make", "Toyota")
    vehicle.model = overrides.get("model", "Camry")
    vehicle.vehicle_type = overrides.get("vehicle_type", MagicMock(value="car"))
    return vehicle


VEHICLE_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


@pytest.fixture(autouse=True)
def _set_api_key():
    with patch("app.services.discrepancy_detection.settings") as mock_settings:
        mock_settings.gemini_api_key = "test-key"
        yield mock_settings


def _mock_session(vehicle=None):
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = vehicle
    session.execute.return_value = result
    return session


async def test_no_discrepancies(_set_api_key):
    vehicle = _mock_vehicle()
    session = _mock_session(vehicle)

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(_discrepancy_json())
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.discrepancy_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_discrepancies(
            VEHICLE_ID, ORG_ID, b"fake-image", "image/jpeg", session
        )

    assert result.match_confidence == pytest.approx(0.95)
    assert result.discrepancies == []
    assert result.image_analysis_summary == "White Toyota Camry sedan"


async def test_with_discrepancies(_set_api_key):
    vehicle = _mock_vehicle()
    session = _mock_session(vehicle)

    discrepancy_data = _discrepancy_json(
        match_confidence=0.3,
        image_analysis_summary="Red Honda Civic sedan",
        discrepancies=[
            {
                "field": "make",
                "expected": "Toyota",
                "detected": "Honda",
                "severity": "high",
            },
            {
                "field": "model",
                "expected": "Camry",
                "detected": "Civic",
                "severity": "high",
            },
        ],
    )

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(discrepancy_data)
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.discrepancy_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_discrepancies(
            VEHICLE_ID, ORG_ID, b"fake-image", "image/jpeg", session
        )

    assert result.match_confidence == pytest.approx(0.3)
    assert len(result.discrepancies) == 2
    assert result.discrepancies[0].field == "make"
    assert result.discrepancies[0].expected == "Toyota"
    assert result.discrepancies[0].detected == "Honda"
    assert result.discrepancies[0].severity.value == "high"
    assert result.discrepancies[1].field == "model"


async def test_detect_discrepancies_uses_model_from_settings(_set_api_key):
    _set_api_key.gemini_model = "gemini-custom-model"
    vehicle = _mock_vehicle()
    session = _mock_session(vehicle)

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(_discrepancy_json())
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.discrepancy_detection.genai.Client",
        return_value=mock_client,
    ):
        await detect_discrepancies(
            VEHICLE_ID, ORG_ID, b"fake-image", "image/jpeg", session
        )

    call_kwargs = mock_aio_models.generate_content.call_args
    assert call_kwargs.kwargs["model"] == "gemini-custom-model"


async def test_raises_without_api_key():
    with patch("app.services.discrepancy_detection.settings") as mock_settings:
        mock_settings.gemini_api_key = ""
        session = _mock_session()

        with pytest.raises(RuntimeError, match="AI features are not configured"):
            await detect_discrepancies(
                VEHICLE_ID, ORG_ID, b"fake-image", "image/jpeg", session
            )


async def test_vehicle_not_found(_set_api_key):
    session = _mock_session(vehicle=None)

    with pytest.raises(LookupError, match="not found"):
        await detect_discrepancies(
            VEHICLE_ID, ORG_ID, b"fake-image", "image/jpeg", session
        )


async def test_unparseable_gemini_response(_set_api_key):
    vehicle = _mock_vehicle()
    session = _mock_session(vehicle)

    mock_aio_models = AsyncMock()
    mock_aio_models.generate_content.return_value = _mock_response(
        "I cannot analyze this image properly"
    )
    mock_client = MagicMock()
    mock_client.aio.models = mock_aio_models

    with patch(
        "app.services.discrepancy_detection.genai.Client",
        return_value=mock_client,
    ):
        result = await detect_discrepancies(
            VEHICLE_ID, ORG_ID, b"fake-image", "image/jpeg", session
        )

    assert result.match_confidence == 0.0
    assert result.image_analysis_summary == "Failed to analyze image."
    assert result.discrepancies == []
