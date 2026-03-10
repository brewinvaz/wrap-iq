import httpx

from app.models.vehicle import VehicleType
from app.schemas.vin import VehicleInfo

NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"

# Simple in-memory cache for decoded VINs
_cache: dict[str, VehicleInfo] = {}


def _get_str(result: dict, key: str) -> str:
    """Extract a non-empty string from NHTSA result, or empty string."""
    val = result.get(key, "")
    if not val or val == "Not Applicable":
        return ""
    return str(val).strip()


def _get_int(result: dict, key: str) -> int | None:
    """Extract an integer from NHTSA result, or None."""
    val = _get_str(result, key)
    if not val:
        return None
    try:
        return int(val)
    except ValueError:
        return None


def _classify_vehicle_type(result: dict) -> VehicleType:
    """Map NHTSA BodyClass and VehicleType to our VehicleType enum."""
    body_class = _get_str(result, "BodyClass").lower()
    vehicle_type_raw = _get_str(result, "VehicleType").lower()
    gvwr = _get_str(result, "GVWR").lower()

    # Parse GVW weight for truck classification
    gvw_lbs = 0
    if gvwr:
        # NHTSA returns ranges like "Class 1: 6,000 lb or less"
        import re

        numbers = re.findall(r"[\d,]+", gvwr.replace(",", ""))
        if numbers:
            try:
                gvw_lbs = int(numbers[-1])
            except ValueError:
                gvw_lbs = 0

    # Check body class keywords
    if any(kw in body_class for kw in ("sedan", "coupe", "convertible", "hatchback")):
        return VehicleType.CAR

    if "sport utility" in body_class:
        return VehicleType.SUV

    if "pickup" in body_class:
        return VehicleType.PICKUP

    if "cargo van" in body_class or "cutaway" in body_class:
        return VehicleType.UTILITY_VAN

    if "van" in body_class or "minivan" in body_class:
        return VehicleType.VAN

    if "trailer" in body_class or "trailer" in vehicle_type_raw:
        return VehicleType.TRAILER

    if "truck" in body_class or "truck" in vehicle_type_raw:
        if gvw_lbs > 26000:
            return VehicleType.SEMI
        if gvw_lbs > 10000:
            return VehicleType.BOX_TRUCK
        return VehicleType.BOX_TRUCK

    return VehicleType.CAR


async def decode_vin(vin: str) -> VehicleInfo:
    """Decode a VIN using the NHTSA vPIC API.

    Results are cached in memory to avoid repeated API calls.
    Raises httpx.HTTPError or ValueError on failure.
    """
    vin = vin.upper()

    if vin in _cache:
        return _cache[vin]

    url = NHTSA_URL.format(vin=vin)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()

    data = response.json()
    results = data.get("Results", [])
    if not results:
        msg = "No results returned from NHTSA API"
        raise ValueError(msg)

    result = results[0]

    vehicle_type = _classify_vehicle_type(result)

    info = VehicleInfo(
        vin=vin,
        year=_get_int(result, "ModelYear"),
        make=_get_str(result, "Make") or None,
        model=_get_str(result, "Model") or None,
        vehicle_type=vehicle_type,
        raw_body_class=_get_str(result, "BodyClass"),
    )

    # Extract conditional fields based on vehicle type
    if vehicle_type == VehicleType.PICKUP:
        info.truck_cab_size = _get_str(result, "CabType") or None
        info.truck_bed_length = _get_str(result, "BedLengthIN") or None

    if vehicle_type in (VehicleType.VAN, VehicleType.UTILITY_VAN):
        info.van_roof_height = _get_str(result, "RoofHeight") or None
        info.van_wheelbase = _get_str(result, "WheelBaseShort") or None
        info.van_length = _get_str(result, "BodyLength") or None

    if vehicle_type in (VehicleType.BOX_TRUCK, VehicleType.SEMI):
        info.truck_cab_size = _get_str(result, "CabType") or None

    _cache[vin] = info
    return info


def clear_cache() -> None:
    """Clear the VIN decode cache (useful for testing)."""
    _cache.clear()
