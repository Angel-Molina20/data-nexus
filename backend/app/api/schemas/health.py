from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["datanexus-api"]


class ReadinessDependencies(BaseModel):
    postgres: Literal["ok"]


class ReadinessResponse(BaseModel):
    status: Literal["ready"]
    dependencies: ReadinessDependencies
