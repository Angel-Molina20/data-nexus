from collections.abc import Callable

from app.domain.connections.adapters import DataSourceAdapter
from app.domain.connections.errors import PublicError
from app.domain.connections.models import ConnectionParameters, Engine

AdapterFactory = Callable[[ConnectionParameters], DataSourceAdapter]


class AdapterRegistry:
    def __init__(self) -> None:
        self._factories: dict[Engine, AdapterFactory] = {}

    def register(self, engine: Engine, factory: AdapterFactory) -> None:
        self._factories[engine] = factory

    def create(self, engine: Engine, parameters: ConnectionParameters) -> DataSourceAdapter:
        try:
            return self._factories[engine](parameters)
        except KeyError as error:
            raise PublicError(
                code="PROVIDER_UNSUPPORTED",
                message="El motor solicitado todavía no está disponible.",
                status_code=400,
            ) from error
