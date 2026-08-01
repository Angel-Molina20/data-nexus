from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class ExecutionStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"


@dataclass(frozen=True)
class ExecutionColumn:
    key: str
    label: str
    data_type: str
    nullable: bool
    source: str | None = None
    format: str | None = None


@dataclass(frozen=True)
class ExecutionResult:
    columns: tuple[ExecutionColumn, ...]
    rows: tuple[dict[str, Any], ...]
    truncated: bool
    approximate_bytes: int
    warnings: tuple[str, ...] = field(default_factory=tuple)
