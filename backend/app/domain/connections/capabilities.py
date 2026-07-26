from app.domain.connections.models import MySQLCapabilities, Provider


def build_mysql_capabilities(
    version: tuple[int, int, int],
    provider: Provider,
) -> MySQLCapabilities:
    if provider is Provider.MARIADB:
        return MySQLCapabilities(
            supports_cte=version >= (10, 2, 1),
            supports_recursive_cte=version >= (10, 2, 2),
            supports_window_functions=version >= (10, 2, 0),
        )
    if provider is Provider.UNKNOWN:
        return MySQLCapabilities()
    return MySQLCapabilities(
        supports_cte=version >= (8, 0, 1),
        supports_recursive_cte=version >= (8, 0, 1),
        supports_window_functions=version >= (8, 0, 2),
        supports_json_type=version >= (5, 7, 8),
        supports_json_table=version >= (8, 0, 4),
        supports_explain_json=version >= (5, 6, 5),
        supports_explain_tree=version >= (8, 0, 16),
        supports_explain_analyze=version >= (8, 0, 18),
    )
