import json
import logging

from google import genai
from google.genai import types

from app.config import settings
from app.schemas.vehicle_detection import (
    DetectionSuggestion,
    VehicleDetectionResponse,
)

logger = logging.getLogger(__name__)

DETECTION_PROMPT = (
    "Analyze this vehicle image. Return ONLY valid JSON (no markdown, no code "
    "fences) with these fields:\n"
    '- "year": integer or null\n'
    '- "make": string or null\n'
    '- "model": string or null\n'
    '- "vehicle_type": one of "car", "suv", "pickup", "van", "utility_van", '
    '"box_truck", "semi", "trailer", or null\n'
    '- "color": string or null\n'
    '- "confidence": float between 0 and 1\n'
    '- "suggestions": array of objects with "year", "make", "model", '
    '"confidence" (alternate possible matches)\n\n'
    "If you cannot identify the vehicle, set confidence to 0 and fields to null."
)

VALID_VEHICLE_TYPES = {
    "car",
    "suv",
    "pickup",
    "van",
    "utility_van",
    "box_truck",
    "semi",
    "trailer",
}


async def detect_vehicle_from_image(
    image_data: bytes,
    content_type: str,
) -> VehicleDetectionResponse:
    """Detect vehicle year/make/model from an image using Gemini vision.

    Raises:
        RuntimeError: If AI features are not configured (no API key).
        google.genai.errors.APIError: If the Gemini API returns an error.
    """
    if not settings.gemini_api_key:
        msg = "AI features are not configured. Set GEMINI_API_KEY."
        raise RuntimeError(msg)

    client = genai.Client(api_key=settings.gemini_api_key)

    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=[
            types.Part.from_bytes(data=image_data, mime_type=content_type),
            DETECTION_PROMPT,
        ],
    )

    raw_text = response.text
    return _parse_response(raw_text)


def _parse_response(raw_text: str) -> VehicleDetectionResponse:
    """Parse the Gemini JSON response into a VehicleDetectionResponse."""
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Gemini response as JSON: %s", raw_text)
        return VehicleDetectionResponse(confidence=0.0)

    # Sanitize vehicle_type
    vehicle_type = data.get("vehicle_type")
    if vehicle_type and vehicle_type not in VALID_VEHICLE_TYPES:
        vehicle_type = None

    # Build suggestions
    suggestions = []
    for s in data.get("suggestions", []):
        suggestions.append(
            DetectionSuggestion(
                year=s.get("year"),
                make=s.get("make"),
                model=s.get("model"),
                confidence=max(0.0, min(1.0, float(s.get("confidence", 0)))),
            )
        )

    return VehicleDetectionResponse(
        year=data.get("year"),
        make=data.get("make"),
        model=data.get("model"),
        vehicle_type=vehicle_type,
        color=data.get("color"),
        confidence=max(0.0, min(1.0, float(data.get("confidence", 0)))),
        suggestions=suggestions,
    )
