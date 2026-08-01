import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.auth import (
    ConnectionAccess,
    Permission,
    Role,
    RolePermission,
    User,
    UserRole,
    UserSession,
)


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def user_by_email(self, normalized_email: str, *, lock: bool = False) -> User | None:
        statement = select(User).where(User.normalized_email == normalized_email)
        if lock:
            statement = statement.with_for_update()
        return (await self.session.scalars(statement)).one_or_none()

    async def user(self, user_id: uuid.UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def users(self, search: str | None = None, status: str | None = None) -> list[User]:
        statement = select(User)
        if search:
            statement = statement.where(
                func.lower(User.email + " " + User.full_name).contains(search.casefold())
            )
        if status:
            statement = statement.where(User.status == status)
        return list((await self.session.scalars(statement.order_by(User.full_name))).all())

    async def active_admin_count(self, excluding: uuid.UUID | None = None) -> int:
        administrator = select(Role.id).where(Role.code == "administrator").scalar_subquery()
        statement = (
            select(func.count())
            .select_from(User)
            .join(UserRole)
            .where(UserRole.role_id == administrator, User.status == "active")
        )
        if excluding:
            statement = statement.where(User.id != excluding)
        return int((await self.session.scalar(statement)) or 0)

    async def create_user(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        return user

    async def session_by_token_hash(self, token_hash: str) -> UserSession | None:
        return (
            await self.session.scalars(
                select(UserSession).where(UserSession.token_hash == token_hash)
            )
        ).one_or_none()

    async def create_session(self, model: UserSession) -> UserSession:
        self.session.add(model)
        await self.session.flush()
        return model

    async def sessions(self, user_id: uuid.UUID) -> list[UserSession]:
        return list(
            (
                await self.session.scalars(
                    select(UserSession)
                    .where(UserSession.user_id == user_id)
                    .order_by(UserSession.created_at.desc())
                )
            ).all()
        )

    async def revoke_sessions(
        self, user_id: uuid.UUID, reason: str, excluding: uuid.UUID | None = None
    ) -> None:
        statement = update(UserSession).where(
            UserSession.user_id == user_id, UserSession.is_active.is_(True)
        )
        if excluding:
            statement = statement.where(UserSession.id != excluding)
        await self.session.execute(
            statement.values(is_active=False, revoked_at=datetime.now(UTC), revoked_reason=reason)
        )

    async def roles_for_user(self, user_id: uuid.UUID) -> list[Role]:
        return list(
            (
                await self.session.scalars(
                    select(Role)
                    .join(UserRole)
                    .where(UserRole.user_id == user_id)
                    .order_by(Role.name)
                )
            ).all()
        )

    async def permissions_for_user(self, user_id: uuid.UUID) -> set[str]:
        rows = await self.session.scalars(
            select(Permission.code)
            .join(RolePermission)
            .join(Role)
            .join(UserRole)
            .where(UserRole.user_id == user_id)
        )
        return set(rows.all())

    async def all_roles(self) -> list[Role]:
        return list((await self.session.scalars(select(Role).order_by(Role.name))).all())

    async def all_permissions(self) -> list[Permission]:
        return list(
            (
                await self.session.scalars(
                    select(Permission).order_by(Permission.resource_type, Permission.code)
                )
            ).all()
        )

    async def role(self, role_id: uuid.UUID) -> Role | None:
        return await self.session.get(Role, role_id)

    async def set_user_roles(self, user_id: uuid.UUID, role_ids: list[uuid.UUID]) -> None:
        await self.session.execute(delete(UserRole).where(UserRole.user_id == user_id))
        self.session.add_all(UserRole(user_id=user_id, role_id=role_id) for role_id in role_ids)
        await self.session.flush()

    async def set_role_permissions(
        self, role_id: uuid.UUID, permission_ids: list[uuid.UUID]
    ) -> None:
        await self.session.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
        self.session.add_all(
            RolePermission(role_id=role_id, permission_id=item) for item in permission_ids
        )
        await self.session.flush()

    async def connection_access(
        self, user_id: uuid.UUID, connection_id: uuid.UUID
    ) -> ConnectionAccess | None:
        return (
            await self.session.scalars(
                select(ConnectionAccess).where(
                    ConnectionAccess.user_id == user_id,
                    ConnectionAccess.connection_id == connection_id,
                )
            )
        ).one_or_none()

    async def accessible_connection_ids(self, user_id: uuid.UUID) -> set[uuid.UUID]:
        return set(
            (
                await self.session.scalars(
                    select(ConnectionAccess.connection_id).where(
                        ConnectionAccess.user_id == user_id
                    )
                )
            ).all()
        )

    async def connection_accesses(
        self, connection_id: uuid.UUID
    ) -> list[tuple[ConnectionAccess, User]]:
        rows = await self.session.execute(
            select(ConnectionAccess, User)
            .join(User, User.id == ConnectionAccess.user_id)
            .where(ConnectionAccess.connection_id == connection_id)
        )
        return [(access, user) for access, user in rows.all()]

    async def grant_access(
        self, user_id: uuid.UUID, connection_id: uuid.UUID, level: str, actor_id: uuid.UUID
    ) -> ConnectionAccess:
        model = await self.connection_access(user_id, connection_id)
        if model is None:
            model = ConnectionAccess(
                user_id=user_id,
                connection_id=connection_id,
                access_level=level,
                granted_by=actor_id,
            )
            self.session.add(model)
        else:
            model.access_level = level
            model.granted_by = actor_id
        await self.session.flush()
        return model

    async def revoke_access(self, user_id: uuid.UUID, connection_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(ConnectionAccess).where(
                ConnectionAccess.user_id == user_id, ConnectionAccess.connection_id == connection_id
            )
        )


async def seed_rbac(session: AsyncSession) -> None:
    from app.domain.auth.permissions import PERMISSIONS, SYSTEM_ROLES

    permissions: dict[str, Permission] = {}
    for code, (name, resource) in PERMISSIONS.items():
        model = (
            await session.scalars(select(Permission).where(Permission.code == code))
        ).one_or_none()
        if model is None:
            model = Permission(code=code, name=name, description=None, resource_type=resource)
            session.add(model)
        permissions[code] = model
    await session.flush()
    for code, codes in SYSTEM_ROLES.items():
        role = (await session.scalars(select(Role).where(Role.code == code))).one_or_none()
        if role is None:
            role = Role(
                code=code, name=code.title(), description=f"Rol del sistema {code}", is_system=True
            )
            session.add(role)
            await session.flush()
        existing = set(
            (
                await session.scalars(
                    select(Permission.code)
                    .join(RolePermission)
                    .where(RolePermission.role_id == role.id)
                )
            ).all()
        )
        for permission_code in codes - existing:
            session.add(
                RolePermission(role_id=role.id, permission_id=permissions[permission_code].id)
            )
    await session.commit()
