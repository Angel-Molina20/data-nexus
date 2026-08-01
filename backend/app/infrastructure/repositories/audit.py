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
        actor_user_id: uuid.UUID | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        self.session.add(
            AuditLog(
                action=action,
                result=result,
                duration_ms=duration_ms,
                connection_id=connection_id,
                error_code=error_code,
                actor=actor,
                actor_user_id=actor_user_id,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=ip_address,
                user_agent=user_agent[:255] if user_agent else None,
            )
        )
        await self.session.flush()
