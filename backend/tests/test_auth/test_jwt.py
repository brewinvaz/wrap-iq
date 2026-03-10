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


def test_access_token_includes_superadmin_claim():
    uid = uuid.uuid4()
    token = create_access_token(user_id=uid, is_superadmin=True)
    payload = decode_token(token)
    assert payload["is_superadmin"] is True
    assert payload["impersonating"] is False


def test_access_token_default_superadmin_false():
    uid = uuid.uuid4()
    token = create_access_token(user_id=uid)
    payload = decode_token(token)
    assert payload["is_superadmin"] is False
    assert payload["impersonating"] is False


def test_impersonation_token_claims():
    uid = uuid.uuid4()
    org_id = uuid.uuid4()
    token = create_access_token(
        user_id=uid,
        organization_id=org_id,
        role="admin",
        is_superadmin=True,
        impersonating=True,
        real_user_id=uid,
        expire_minutes=60,
    )
    payload = decode_token(token)
    assert payload["is_superadmin"] is True
    assert payload["impersonating"] is True
    assert payload["real_user_id"] == str(uid)
    assert payload["org"] == str(org_id)
