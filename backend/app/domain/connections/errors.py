from dataclasses import dataclass


@dataclass(slots=True)
class PublicError(Exception):
    code: str
    message: str
    status_code: int = 400
    details: dict[str, object] | None = None


RESOURCE_NOT_FOUND = ("RESOURCE_NOT_FOUND", "La conexión solicitada no existe.")
CONNECTION_FAILED = ("CONNECTION_FAILED", "No fue posible establecer conexión con el servidor.")
