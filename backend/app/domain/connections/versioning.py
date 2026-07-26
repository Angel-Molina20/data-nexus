import re

from app.domain.connections.models import ParsedVersion, Provider

VERSION_PATTERN = re.compile(r"(?P<major>\d+)\.(?P<minor>\d+)(?:\.(?P<patch>\d+))?")


def parse_server_version(raw_version: str) -> ParsedVersion:
    match = VERSION_PATTERN.search(raw_version.strip())
    if match is None:
        return ParsedVersion(raw=raw_version, major=0, minor=0, patch=0)
    return ParsedVersion(
        raw=raw_version,
        major=int(match.group("major")),
        minor=int(match.group("minor")),
        patch=int(match.group("patch") or 0),
    )


def detect_provider(raw_version: str, version_comment: str | None) -> Provider:
    evidence = f"{raw_version} {version_comment or ''}".lower()
    if "mariadb" in evidence:
        return Provider.MARIADB
    if "percona" in evidence:
        return Provider.PERCONA
    if raw_version and VERSION_PATTERN.search(raw_version):
        return Provider.MYSQL
    return Provider.UNKNOWN
