"""Tests for rate-limit key extraction logic (get_real_ip)."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.middleware.rate_limit import get_real_ip


def _make_request(
    headers: dict | None = None,
    client_host: str = "127.0.0.1",
    user=None,
):
    """Build a minimal mock Starlette Request."""
    from starlette.datastructures import Headers

    request = MagicMock()
    request.headers = Headers(headers or {})
    request.client.host = client_host

    # Mimic request.state with optional user
    state = SimpleNamespace()
    if user is not None:
        state.user = user
    request.state = state
    return request


class TestGetRealIp:
    """Unit tests for get_real_ip key function."""

    def test_falls_back_to_remote_address(self):
        """Without X-Forwarded-For, uses the direct connection IP."""
        request = _make_request(client_host="10.0.0.5")
        assert get_real_ip(request) == "10.0.0.5"

    def test_uses_x_forwarded_for_single_ip(self):
        """Single IP in X-Forwarded-For is returned."""
        request = _make_request(headers={"X-Forwarded-For": "203.0.113.50"})
        assert get_real_ip(request) == "203.0.113.50"

    def test_uses_first_ip_from_x_forwarded_for_chain(self):
        """When multiple proxies add IPs, the leftmost (client) IP wins."""
        request = _make_request(
            headers={"X-Forwarded-For": "203.0.113.50, 70.41.3.18, 10.0.0.1"}
        )
        assert get_real_ip(request) == "203.0.113.50"

    def test_strips_whitespace_from_forwarded_ip(self):
        request = _make_request(
            headers={"X-Forwarded-For": "  198.51.100.1 , 10.0.0.1"}
        )
        assert get_real_ip(request) == "198.51.100.1"

    def test_empty_x_forwarded_for_falls_back(self):
        """An empty header value should fall back to remote address."""
        request = _make_request(
            headers={"X-Forwarded-For": ""},
            client_host="192.168.1.1",
        )
        assert get_real_ip(request) == "192.168.1.1"

    def test_authenticated_user_returns_user_id(self):
        """When request.state.user is present, use user ID as key."""
        user = SimpleNamespace(id="abc-123")
        request = _make_request(
            headers={"X-Forwarded-For": "203.0.113.50"},
            user=user,
        )
        assert get_real_ip(request) == "user:abc-123"

    def test_user_without_id_falls_through(self):
        """A user object with no id attribute should not be used."""
        user = SimpleNamespace()  # no .id
        request = _make_request(
            headers={"X-Forwarded-For": "203.0.113.50"},
            user=user,
        )
        assert get_real_ip(request) == "203.0.113.50"

    @pytest.mark.parametrize(
        "forwarded,expected",
        [
            ("::1", "::1"),
            ("2001:db8::1, 10.0.0.1", "2001:db8::1"),
        ],
    )
    def test_ipv6_addresses(self, forwarded, expected):
        """IPv6 addresses in X-Forwarded-For are handled correctly."""
        request = _make_request(headers={"X-Forwarded-For": forwarded})
        assert get_real_ip(request) == expected
