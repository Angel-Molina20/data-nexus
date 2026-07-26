import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.audit_log import AuditLog


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record(
        self,
        *,
        action: str,
        result: str,
        duration_ms: int,
        connection_id: uuid.UUID | None = None,
        error_code: str | None = None,
        actor: str = "system",
    ) -> None:
        self.session.add(
            AuditLog(
                action=action,
                result=result,
                duration_ms=duration_ms,
                connection_id=connection_id,
                error_code=error_code,
                actor=actor,
            )
        )
        await self.session.flush()
