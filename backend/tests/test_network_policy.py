import socket

import pytest

from app.domain.connections.errors import PublicError
from app.infrastructure.network.policy import DatabaseHostPolicy


def policy() -> DatabaseHostPolicy:
    return DatabaseHostPolicy(
        allow_private=True,
        allowed_hosts=["mysql56", "mysql8"],
        blocked_hosts=["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "::1"],
    )


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "::1"])
def test_blocked_hosts(host: str) -> None:
    with pytest.raises(PublicError):
        policy().validate(host, 3306)


def test_invalid_port_is_blocked() -> None:
    with pytest.raises(PublicError):
        policy().validate("mysql8", 0)


def test_docker_mysql_is_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("172.18.0.8", 3306))
        ],
    )
    policy().validate("mysql8", 3306)


def test_allowed_host_cannot_resolve_to_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 3306))
        ],
    )
    with pytest.raises(PublicError):
        policy().validate("mysql8", 3306)
