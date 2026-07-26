import pytest

from app.domain.connections.capabilities import build_mysql_capabilities
from app.domain.connections.models import Provider


@pytest.mark.parametrize(
    ("version", "cte", "json_type", "tree", "analyze"),
    [
        ((5, 6, 51), False, False, False, False),
        ((5, 7, 44), False, True, False, False),
        ((8, 0, 4), True, True, False, False),
        ((8, 0, 42), True, True, True, True),
    ],
)
def test_mysql_capability_profiles(
    version: tuple[int, int, int],
    cte: bool,
    json_type: bool,
    tree: bool,
    analyze: bool,
) -> None:
    capabilities = build_mysql_capabilities(version, Provider.MYSQL)
    assert capabilities.supports_cte is cte
    assert capabilities.supports_json_type is json_type
    assert capabilities.supports_explain_tree is tree
    assert capabilities.supports_explain_analyze is analyze


def test_percona_uses_mysql_compatible_profile() -> None:
    assert build_mysql_capabilities((8, 0, 35), Provider.PERCONA).supports_window_functions


def test_mariadb_profile_is_conservative() -> None:
    capabilities = build_mysql_capabilities((10, 6, 18), Provider.MARIADB)
    assert capabilities.supports_cte
    assert not capabilities.supports_json_type
