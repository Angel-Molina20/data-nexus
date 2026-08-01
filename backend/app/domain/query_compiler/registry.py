from collections.abc import Callable

from app.domain.connections.errors import PublicError
from app.domain.query_compiler.base import QueryCompiler

CompilerFactory = Callable[[], QueryCompiler]


class QueryCompilerRegistry:
    def __init__(self) -> None:
        self._factories: dict[str, CompilerFactory] = {}

    def register(self, engine: str, factory: CompilerFactory) -> None:
        self._factories[engine] = factory

    def create(self, engine: str) -> QueryCompiler:
        try:
            return self._factories[engine]()
        except KeyError as error:
            raise PublicError(
                "QUERY_COMPILER_NOT_FOUND", "No existe un compilador para este motor.", 400
            ) from error
