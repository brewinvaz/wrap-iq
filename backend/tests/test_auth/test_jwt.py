import uuid

import pytest

from app.auth.jwt import create_access_token, create_refresh_token, decode_token


def test_create_and_decode_access_token():
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()
    token = create_access_token(user_id=user_id, organization_id=org_id, role="admin")
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["org"] == str(org_id)
    assert payload["role"] == "admin"
    assert payload["type"] == "access"


def test_create_and_decode_refresh_token():
    user_id = uuid.uuid4()
    token = create_refresh_token(user_id=user_id)
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "refresh"


def test_decode_invalid_token():
    with pytest.raises(Exception):
        decode_token("invalid.token.here")
