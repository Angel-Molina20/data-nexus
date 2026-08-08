from pathlib import Path

import pytest

from app.application.reports import safe_file_name
from app.infrastructure.storage.local import LocalFileStorage


def test_local_storage_uses_unpredictable_keys_and_restrictive_permissions(tmp_path: Path) -> None:
    storage = LocalFileStorage(str(tmp_path / "exports"))
    first_key, first_path = storage.allocate("csv")
    second_key, _ = storage.allocate("csv")
    first_path.write_bytes(b"safe")
    storage.secure_permissions(first_path)

    assert first_key != second_key
    assert storage.exists(first_key)
    assert storage.size(first_key) == 4
    assert first_path.stat().st_mode & 0o777 == 0o600
    assert storage.delete(first_key)
    assert not storage.delete(first_key)


@pytest.mark.parametrize("key", ["../secret.csv", "/tmp/secret.csv", "folder/file.csv"])
def test_local_storage_rejects_path_traversal(tmp_path: Path, key: str) -> None:
    storage = LocalFileStorage(str(tmp_path / "exports"))
    with pytest.raises(ValueError):
        storage.exists(key)


def test_download_name_is_sanitized() -> None:
    value = safe_file_name("../../reporte <script>alert(1)</script>", "xlsx")
    assert "/" not in value
    assert "<" not in value
    assert value.endswith(".xlsx")
