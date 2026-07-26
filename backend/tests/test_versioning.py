import pytest

from app.domain.connections.models import Provider
from app.domain.connections.versioning import detect_provider, parse_server_version


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("5.6.51-log", (5, 6, 51)),
        ("8.0.42", (8, 0, 42)),
        ("5.7.44-Percona", (5, 7, 44)),
        ("10.6.18-MariaDB", (10, 6, 18)),
        ("8.4.0", (8, 4, 0)),
    ],
)
def test_parse_server_version(raw: str, expected: tuple[int, int, int]) -> None:
    assert parse_server_version(raw).tuple == expected


def test_unknown_version_is_safe() -> None:
    assert parse_server_version("custom").tuple == (0, 0, 0)


@pytest.mark.parametrize(
    ("version", "comment", "provider"),
    [
        ("8.0.42", "MySQL Community Server", Provider.MYSQL),
        ("5.7.44-Percona", "Percona Server", Provider.PERCONA),
        ("10.6.18-MariaDB", "MariaDB Server", Provider.MARIADB),
        ("custom", None, Provider.UNKNOWN),
    ],
)
def test_detect_provider(version: str, comment: str | None, provider: Provider) -> None:
    assert detect_provider(version, comment) is provider
