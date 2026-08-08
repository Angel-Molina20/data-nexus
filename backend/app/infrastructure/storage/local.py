import os
import uuid
from pathlib import Path
from typing import BinaryIO


class LocalFileStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)

    def allocate(self, extension: str) -> tuple[str, Path]:
        safe_extension = extension.lower().lstrip(".")
        if safe_extension not in {"csv", "xlsx", "pdf"}:
            raise ValueError("Unsupported extension")
        key = f"{uuid.uuid4().hex}.{safe_extension}"
        return key, self._path(key)

    def open(self, key: str) -> BinaryIO:
        return self._path(key).open("rb")

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> bool:
        path = self._path(key)
        try:
            path.unlink()
        except FileNotFoundError:
            return False
        return True

    def size(self, key: str) -> int:
        return self._path(key).stat().st_size

    def _path(self, key: str) -> Path:
        if Path(key).name != key:
            raise ValueError("Invalid storage key")
        path = (self.root / key).resolve()
        if path.parent != self.root:
            raise ValueError("Invalid storage key")
        return path

    @staticmethod
    def secure_permissions(path: Path) -> None:
        os.chmod(path, 0o600)
