from abc import ABC, abstractmethod

from app.domain.query_compiler.models import CompilationContext, CompilationResult


class QueryCompiler(ABC):
    @abstractmethod
    def compile(self, context: CompilationContext) -> CompilationResult:
        """Compile a universal query without opening or executing a data-source connection."""
