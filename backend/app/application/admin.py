import uuid
from datetime import UTC, datetime

from app.api.schemas.auth import UserCreateRequest, UserResponse
from app.application.auth import AuthContext, SessionPrincipal
from app.db.models.auth import User
from app.domain.auth.policies import normalize_email, validate_password
from app.domain.connections.errors import PublicError


async def user_response(context: AuthContext, user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        status=user.status,
        is_superuser=user.is_superuser,
        must_change_password=user.must_change_password,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        last_login_at=user.last_login_at,
        roles=[role.code for role in await context.auth.roles_for_user(user.id)],
        created_at=user.created_at,
    )


class CreateUserService:
    def __init__(self, context: AuthContext) -> None:
        self.context = context

    async def execute(self, payload: UserCreateRequest, actor: SessionPrincipal) -> UserResponse:
        normalized = normalize_email(payload.email)
        if await self.context.auth.user_by_email(normalized):
            raise PublicError("USER_ALREADY_EXISTS", "Ya existe un usuario con ese correo.", 409)
        validate_password(payload.password, self.context.settings)
        model = User(
            email=payload.email.strip(),
            normalized_email=normalized,
            full_name=payload.full_name,
            password_hash=self.context.passwords.hash(payload.password),
            status="active",
            must_change_password=payload.must_change_password,
            created_by=str(actor.user.id),
            updated_by=str(actor.user.id),
        )
        await self.context.auth.create_user(model)
        await self.context.auth.set_user_roles(model.id, payload.role_ids)
        await self.context.audit.record(
            action="security.user_create",
            result="success",
            duration_ms=0,
            actor=actor.user.normalized_email,
            actor_user_id=actor.user.id,
            resource_type="user",
            resource_id=str(model.id),
        )
        await self.context.session.commit()
        return await user_response(self.context, model)


class UserLifecycleService:
    def __init__(self, context: AuthContext) -> None:
        self.context = context

    async def require_user(self, user_id: uuid.UUID) -> User:
        user = await self.context.auth.user(user_id)
        if user is None:
            raise PublicError("USER_NOT_FOUND", "El usuario no existe.", 404)
        return user

    async def set_status(
        self, user_id: uuid.UUID, status: str, actor: SessionPrincipal
    ) -> UserResponse:
        user = await self.require_user(user_id)
        if (
            status != "active"
            and user.status == "active"
            and await self.context.auth.active_admin_count(excluding=user.id) == 0
        ):
            roles = {role.code for role in await self.context.auth.roles_for_user(user.id)}
            if user.is_superuser or "administrator" in roles:
                raise PublicError(
                    "LAST_ADMIN_REQUIRED", "Debe permanecer al menos un administrador activo.", 409
                )
        user.status = status
        if status == "active":
            user.failed_login_attempts = 0
            user.locked_until = None
        else:
            await self.context.auth.revoke_sessions(user.id, f"user_{status}")
        user.updated_by = str(actor.user.id)
        await self.context.session.commit()
        return await user_response(self.context, user)

    async def reset_password(
        self, user_id: uuid.UUID, password: str, must_change: bool, actor: SessionPrincipal
    ) -> UserResponse:
        user = await self.require_user(user_id)
        validate_password(password, self.context.settings)
        user.password_hash = self.context.passwords.hash(password)
        user.password_changed_at = datetime.now(UTC)
        user.must_change_password = must_change
        await self.context.auth.revoke_sessions(user.id, "password_reset")
        await self.context.session.commit()
        return await user_response(self.context, user)
