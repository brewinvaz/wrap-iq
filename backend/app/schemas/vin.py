import re
from enum import StrEnum

from pydantic import BaseModel, field_validator


class VehicleType(StrEnum):
    CAR = "Car"
    SUV = "SUV"
    PICKUP = "Pickup"
    VAN = "Van"
    UTILITY_VAN = "Utility Van"
    BOX_TRUCK = "Box Truck"
    SEMI = "Semi"
    TRAILER = "Trailer"


# VIN must be 17 alphanumeric chars, excluding I, O, Q
_VIN_PATTERN = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$", re.IGNORECASE)


class VinDecodeRequest(BaseModel):
    vin: str

    @field_validator("vin")
    @classmethod
    def validate_vin(cls, v: str) -> str:
        v = v.strip().upper()
        if not _VIN_PATTERN.match(v):
            msg = "VIN must be exactly 17 alphanumeric characters (excluding I, O, Q)"
            raise ValueError(msg)
        return v


class VehicleInfo(BaseModel):
    vin: str
    year: int | None = None
    make: str | None = None
    model: str | None = None
    vehicle_type: VehicleType = VehicleType.CAR
    truck_cab_size: str | None = None
    truck_bed_length: str | None = None
    van_roof_height: str | None = None
    van_wheelbase: str | None = None
    van_length: str | None = None
    raw_body_class: str = ""
