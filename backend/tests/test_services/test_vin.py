from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.schemas.vin import VehicleType
from app.services.vin import clear_cache, decode_vin


def _nhtsa_response(
    body_class="Sedan",
    vehicle_type="PASSENGER CAR",
    make="Toyota",
    model="Camry",
    year="2023",
    gvwr="",
    cab_type="",
    bed_length="",
    error_code="0",
):
    """Build a mock NHTSA API JSON response."""
    return {
        "Results": [
            {
                "BodyClass": body_class,
                "VehicleType": vehicle_type,
                "Make": make,
                "Model": model,
                "ModelYear": year,
                "GVWR": gvwr,
                "CabType": cab_type,
                "BedLengthIN": bed_length,
                "RoofHeight": "",
                "WheelBaseShort": "",
                "BodyLength": "",
                "ErrorCode": error_code,
            }
        ]
    }


@pytest.fixture(autouse=True)
def _clear_vin_cache():
    clear_cache()
    yield
    clear_cache()


def _mock_response(json_data, status_code=200):
    """Create a mock httpx.Response."""
    response = httpx.Response(
        status_code=status_code,
        json=json_data,
        request=httpx.Request("GET", "https://example.com"),
    )
    return response


async def test_decode_sedan():
    mock_resp = _mock_response(_nhtsa_response())
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await decode_vin("1HGBH41JXMN109186")

    assert result.vin == "1HGBH41JXMN109186"
    assert result.year == 2023
    assert result.make == "Toyota"
    assert result.model == "Camry"
    assert result.vehicle_type == VehicleType.CAR
    assert result.raw_body_class == "Sedan"


async def test_decode_suv():
    mock_resp = _mock_response(
        _nhtsa_response(
            body_class="Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)",
            make="Ford",
            model="Explorer",
        )
    )
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await decode_vin("1FMSK8DH5LGA12345")

    assert result.vehicle_type == VehicleType.SUV


async def test_decode_pickup():
    mock_resp = _mock_response(
        _nhtsa_response(
            body_class="Pickup",
            make="Ford",
            model="F-150",
            cab_type="Crew Cab",
            bed_length="67",
        )
    )
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await decode_vin("1FTFW1E50LFA12345")

    assert result.vehicle_type == VehicleType.PICKUP
    assert result.truck_cab_size == "Crew Cab"
    assert result.truck_bed_length == "67"


async def test_decode_cargo_van():
    mock_resp = _mock_response(
        _nhtsa_response(
            body_class="Cargo Van",
            make="Mercedes-Benz",
            model="Sprinter",
        )
    )
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await decode_vin("WDAPF4CC5L9A12345")

    assert result.vehicle_type == VehicleType.UTILITY_VAN


async def test_decode_van():
    mock_resp = _mock_response(
        _nhtsa_response(
            body_class="Van",
            make="Honda",
            model="Odyssey",
        )
    )
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await decode_vin("5FNRL6H75LB012345")

    assert result.vehicle_type == VehicleType.VAN


async def test_decode_truck_heavy():
    mock_resp = _mock_response(
        _nhtsa_response(
            body_class="Truck",
            vehicle_type="TRUCK",
            make="Freightliner",
            model="Cascadia",
            gvwr="Class 8: 33,001 lb and above",
        )
    )
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await decode_vin("3AKJHHDR5LSLA1234")

    assert result.vehicle_type == VehicleType.SEMI


async def test_decode_trailer():
    mock_resp = _mock_response(
        _nhtsa_response(
            body_class="Trailer",
            vehicle_type="TRAILER",
            make="Utility",
            model="4000DX",
        )
    )
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await decode_vin("1UYVS2539LU123456")

    assert result.vehicle_type == VehicleType.TRAILER


async def test_cache_prevents_second_api_call():
    mock_resp = _mock_response(_nhtsa_response())
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        await decode_vin("1HGBH41JXMN109186")
        await decode_vin("1HGBH41JXMN109186")

        # Only one HTTP call should have been made
        assert mock_client.get.call_count == 1


async def test_decode_timeout_raises():
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.TimeoutException("timeout")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(httpx.TimeoutException):
            await decode_vin("1HGBH41JXMN109186")


async def test_decode_http_error_raises():
    error_resp = httpx.Response(
        status_code=500,
        request=httpx.Request("GET", "https://example.com"),
    )
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = error_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(httpx.HTTPStatusError):
            await decode_vin("1HGBH41JXMN109186")


async def test_decode_no_results_raises():
    mock_resp = _mock_response({"Results": []})
    with patch("app.services.vin.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(ValueError, match="No results"):
            await decode_vin("1HGBH41JXMN109186")
