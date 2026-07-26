from abc import ABC, abstractmethod

from app.domain.connections.models import MySQLCapabilities, ServerInspection
from app.domain.schema.models import InspectedSchema


class DataSourceAdapter(ABC):
    @abstractmethod
    def test_connection(self) -> None:
        """Check that the data source accepts the connection."""

    @abstractmethod
    def inspect_server(self) -> ServerInspection:
        """Return normalized server information."""

    @abstractmethod
    def detect_capabilities(self) -> MySQLCapabilities:
        """Return the centralized capability profile."""

    @abstractmethod
    def inspect_schema(
        self,
        *,
        include_views: bool,
        max_entities: int,
        include_system_schemas: bool,
    ) -> InspectedSchema:
        """Return universal structural metadata without reading business rows."""

    @abstractmethod
    def close(self) -> None:
        """Release engines, pools, and connections."""

    def __enter__(self) -> "DataSourceAdapter":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
