import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.auth import User, UserSession
from app.domain.auth.permissions import ACCESS_LEVELS, PERMISSIONS
from app.domain.auth.policies import (
    hash_token,
    new_token,
    normalize_email,
    token_matches,
    validate_password,
)
from app.domain.connections.errors import PublicError
from app.infrastructure.repositories.audit import AuditRepository
from app.infrastructure.repositories.auth import AuthRepository
from app.infrastructure.security.passwords import PasswordService
from app.infrastructure.security.rate_limit import RateLimiter


@dataclass
class AuthContext:
    session: AsyncSession
    auth: AuthRepository
    audit: AuditRepository
    passwords: PasswordService
    limiter: RateLimiter
    settings: Settings


@dataclass(frozen=True)
class SessionPrincipal:
    user: User
    session: UserSession
    roles: list[str]
    permissions: set[str]


class AuthorizationService:
    def __init__(self, repository: AuthRepository) -> None:
        self.repository = repository

    async def principal(self, user: User, user_session: UserSession) -> SessionPrincipal:
        roles = [role.code for role in await self.repository.roles_for_user(user.id)]
        permissions = (
            set(PERMISSIONS)
            if user.is_superuser
            else await self.repository.permissions_for_user(user.id)
        )
        return SessionPrincipal(user, user_session, roles, permissions)

    @staticmethod
    def require_permission(principal: SessionPrincipal, code: str) -> None:
        if not principal.user.is_superuser and code not in principal.permissions:
            raise PublicError(
                "PERMISSION_DENIED", "No tienes permiso para realizar esta acción.", 403
            )

    async def require_connection_access(
        self, principal: SessionPrincipal, connection_id: uuid.UUID, required: str
    ) -> None:
        if principal.user.is_superuser:
            return
        access = await self.repository.connection_access(principal.user.id, connection_id)
        if access is None or ACCESS_LEVELS[access.access_level] < ACCESS_LEVELS[required]:
            raise PublicError("RESOURCE_NOT_FOUND", "El recurso solicitado no existe.", 404)


class LoginService:
    def __init__(self, context: AuthContext) -> None:
        self.context = context

    async def execute(
        self, email: str, password: str, ip: str, user_agent: str
    ) -> tuple[SessionPrincipal, str, str]:
        normalized = normalize_email(email)
        await self.context.limiter.login(ip, normalized)
        user = await self.context.auth.user_by_email(normalized, lock=True)
        now = datetime.now(UTC)
        if user is not None and user.status == "locked" and user.locked_until is not None:
            if user.locked_until <= now:
                user.status = "active"
                user.locked_until = None
                user.failed_login_attempts = 0
        valid = user is not None and self.context.passwords.verify(user.password_hash, password)
        allowed = bool(
            user
            and user.status == "active"
            and (user.locked_until is None or user.locked_until <= now)
        )
        if not valid or not allowed:
            if user is not None:
                user.failed_login_attempts += 1
                if user.failed_login_attempts >= self.context.settings.MAX_FAILED_LOGIN_ATTEMPTS:
                    user.locked_until = now + timedelta(
                        minutes=self.context.settings.ACCOUNT_LOCK_MINUTES
                    )
                    user.status = "locked"
            await self.context.audit.record(
                action="security.login",
                result="failed",
                duration_ms=0,
                actor=normalized,
                ip_address=ip,
                user_agent=user_agent,
                error_code="INVALID_CREDENTIALS",
            )
            await self.context.session.commit()
            raise PublicError(
                "INVALID_CREDENTIALS", "Las credenciales ingresadas no son válidas.", 401
            )
        assert user is not None
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        user.last_login_ip = ip
        if self.context.passwords.needs_rehash(user.password_hash):
            user.password_hash = self.context.passwords.hash(password)
        token, csrf = new_token(), new_token()
        model = UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            csrf_token_hash=hash_token(csrf),
            ip_address=ip,
            user_agent=user_agent[:255],
            expires_at=now + timedelta(minutes=self.context.settings.SESSION_IDLE_TIMEOUT_MINUTES),
            absolute_expires_at=now
            + timedelta(hours=self.context.settings.SESSION_ABSOLUTE_TIMEOUT_HOURS),
        )
        await self.context.auth.create_session(model)
        await self.context.audit.record(
            action="security.login",
            result="success",
            duration_ms=0,
            actor=user.normalized_email,
            actor_user_id=user.id,
            ip_address=ip,
            user_agent=user_agent,
        )
        await self.context.session.commit()
        return await AuthorizationService(self.context.auth).principal(user, model), token, csrf


class SessionService:
    def __init__(self, context: AuthContext) -> None:
        self.context = context

    async def resolve(self, token: str) -> SessionPrincipal:
        model = await self.context.auth.session_by_token_hash(hash_token(token))
        now = datetime.now(UTC)
        if model is None or not model.is_active:
            raise PublicError("AUTHENTICATION_REQUIRED", "Debes iniciar sesión.", 401)
        if model.expires_at <= now or model.absolute_expires_at <= now:
            model.is_active = False
            model.revoked_at = now
            model.revoked_reason = "expired"
            await self.context.session.commit()
            raise PublicError("SESSION_EXPIRED", "La sesión expiró.", 401)
        user = await self.context.auth.user(model.user_id)
        if user is None or user.status != "active":
            raise PublicError("AUTHENTICATION_REQUIRED", "Debes iniciar sesión.", 401)
        if now - model.last_seen_at >= timedelta(minutes=5):
            model.last_seen_at = now
            model.expires_at = min(
                now + timedelta(minutes=self.context.settings.SESSION_IDLE_TIMEOUT_MINUTES),
                model.absolute_expires_at,
            )
            await self.context.session.commit()
        return await AuthorizationService(self.context.auth).principal(user, model)

    async def logout(self, principal: SessionPrincipal) -> None:
        principal.session.is_active = False
        principal.session.revoked_at = datetime.now(UTC)
        principal.session.revoked_reason = "logout"
        await self.context.audit.record(
            action="security.logout",
            result="success",
            duration_ms=0,
            actor=principal.user.normalized_email,
            actor_user_id=principal.user.id,
        )
        await self.context.session.commit()

    async def validate_csrf(self, principal: SessionPrincipal, token: str | None) -> None:
        if token is None or not token_matches(token, principal.session.csrf_token_hash):
            raise PublicError("CSRF_TOKEN_INVALID", "El token CSRF no es válido.", 403)


class ChangePasswordService:
    def __init__(self, context: AuthContext) -> None:
        self.context = context

    async def execute(self, principal: SessionPrincipal, current: str, new: str) -> None:
        if not self.context.passwords.verify(principal.user.password_hash, current):
            raise PublicError(
                "INVALID_CREDENTIALS", "Las credenciales ingresadas no son válidas.", 401
            )
        validate_password(new, self.context.settings)
        principal.user.password_hash = self.context.passwords.hash(new)
        principal.user.password_changed_at = datetime.now(UTC)
        principal.user.must_change_password = False
        await self.context.auth.revoke_sessions(
            principal.user.id, "password_changed", excluding=principal.session.id
        )
        await self.context.audit.record(
            action="security.password_change",
            result="success",
            duration_ms=0,
            actor=principal.user.normalized_email,
            actor_user_id=principal.user.id,
        )
        await self.context.session.commit()
