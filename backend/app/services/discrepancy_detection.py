import json
import logging
import uuid

from google import genai
from google.genai import types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.vehicle import Vehicle
from app.schemas.discrepancy_detection import (
    Discrepancy,
    DiscrepancyCheckResponse,
    Severity,
)

logger = logging.getLogger(__name__)

DISCREPANCY_PROMPT_TEMPLATE = (
    "Analyze this vehicle image and compare it against the following vehicle "
    "record on file. Return ONLY valid JSON (no markdown, no code fences) "
    "with these fields:\n"
    '- "match_confidence": float between 0 and 1 indicating overall match\n'
    '- "image_analysis_summary": string describing what you see in the image\n'
    '- "detected_make": string or null\n'
    '- "detected_model": string or null\n'
    '- "detected_color": string or null\n'
    '- "detected_vehicle_type": one of "car", "suv", "pickup", "van", '
    '"utility_van", "box_truck", "semi", "trailer", or null\n'
    '- "discrepancies": array of objects with:\n'
    '  - "field": string (field name that differs)\n'
    '  - "expected": string (value from our records)\n'
    '  - "detected": string (value detected in the image)\n'
    '  - "severity": one of "high", "medium", "low"\n\n'
    "Vehicle record on file:\n"
    "- Make: {make}\n"
    "- Model: {model}\n"
    "- Color: {color}\n"
    "- Vehicle type: {vehicle_type}\n\n"
    "Compare the image against these details. Flag any discrepancies. "
    "Use severity 'high' for make/model mismatches, 'medium' for vehicle "
    "type mismatches, and 'low' for color mismatches."
)

VALID_SEVERITIES = {"high", "medium", "low"}


async def detect_discrepancies(
    vehicle_id: uuid.UUID,
    organization_id: uuid.UUID,
    image_data: bytes,
    content_type: str,
    session: AsyncSession,
) -> DiscrepancyCheckResponse:
    if not settings.gemini_api_key:
        msg = "AI features are not configured. Set GEMINI_API_KEY."
        raise RuntimeError(msg)

    result = await session.execute(
        select(Vehicle).where(
            Vehicle.id == vehicle_id,
            Vehicle.organization_id == organization_id,
        )
    )
    vehicle = result.scalar_one_or_none()

    if vehicle is None:
        raise LookupError(f"Vehicle {vehicle_id} not found")

    prompt = DISCREPANCY_PROMPT_TEMPLATE.format(
        make=vehicle.make or "Unknown",
        model=vehicle.model or "Unknown",
        color="Unknown",
        vehicle_type=vehicle.vehicle_type.value if vehicle.vehicle_type else "Unknown",
    )

    client = genai.Client(api_key=settings.gemini_api_key)

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=image_data, mime_type=content_type),
            prompt,
        ],
    )

    raw_text = response.text
    return _parse_response(raw_text)


def _parse_response(raw_text: str) -> DiscrepancyCheckResponse:
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.warning(
            "Failed to parse Gemini discrepancy response as JSON: %s", raw_text
        )
        return DiscrepancyCheckResponse(
            match_confidence=0.0,
            image_analysis_summary="Failed to analyze image.",
        )

    discrepancies = []
    for d in data.get("discrepancies", []):
        severity = d.get("severity", "low")
        if severity not in VALID_SEVERITIES:
            severity = "low"
        discrepancies.append(
            Discrepancy(
                field=d.get("field", "unknown"),
                expected=d.get("expected"),
                detected=d.get("detected"),
                severity=Severity(severity),
            )
        )

    return DiscrepancyCheckResponse(
        discrepancies=discrepancies,
        match_confidence=max(0.0, min(1.0, float(data.get("match_confidence", 0)))),
        image_analysis_summary=data.get("image_analysis_summary", ""),
    )
