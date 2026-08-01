import threading
import uuid

from app.domain.connections.adapters import DataSourceAdapter


class ActiveExecutionRegistry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._adapters: dict[uuid.UUID, tuple[uuid.UUID, DataSourceAdapter]] = {}

    def register(
        self, execution_id: uuid.UUID, user_id: uuid.UUID, adapter: DataSourceAdapter
    ) -> None:
        with self._lock:
            self._adapters[execution_id] = (user_id, adapter)

    def remove(self, execution_id: uuid.UUID) -> None:
        with self._lock:
            self._adapters.pop(execution_id, None)

    def active_for_user(self, user_id: uuid.UUID) -> int:
        with self._lock:
            return sum(owner == user_id for owner, _ in self._adapters.values())

    def cancel(self, execution_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        with self._lock:
            item = self._adapters.get(execution_id)
        return bool(item and item[0] == user_id and item[1].cancel_query())


active_execution_registry = ActiveExecutionRegistry()
