import argparse
import asyncio
import getpass

from sqlalchemy import select

from app.core.config import get_settings
from app.db.models.auth import Role, User, UserRole
from app.db.session import async_session_factory, close_database_engine
from app.domain.auth.policies import normalize_email, validate_password
from app.infrastructure.repositories.auth import seed_rbac
from app.infrastructure.security.passwords import password_service


async def create_admin() -> None:
    email = (await asyncio.to_thread(input, "Correo: ")).strip()
    full_name = (await asyncio.to_thread(input, "Nombre completo: ")).strip()
    password = await asyncio.to_thread(getpass.getpass, "Contraseña: ")
    confirmation = await asyncio.to_thread(getpass.getpass, "Confirmación: ")
    if password != confirmation:
        raise SystemExit("Las contraseñas no coinciden.")
    validate_password(password, get_settings())
    async with async_session_factory() as session:
        await seed_rbac(session)
        if await session.scalar(
            select(User.id).where(User.normalized_email == normalize_email(email))
        ):
            raise SystemExit("Ya existe un usuario con ese correo.")
        role = (await session.scalars(select(Role).where(Role.code == "administrator"))).one()
        user = User(
            email=email,
            normalized_email=normalize_email(email),
            full_name=full_name,
            password_hash=password_service.hash(password),
            status="active",
            is_superuser=True,
            must_change_password=False,
            created_by="bootstrap",
            updated_by="bootstrap",
        )
        session.add(user)
        await session.flush()
        session.add(UserRole(user_id=user.id, role_id=role.id))
        await session.commit()
    print("Administrador creado.")


async def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    parser.add_argument("command", choices=["seed-rbac", "create-admin"])
    args = parser.parse_args()
    try:
        if args.command == "create-admin":
            await create_admin()
        else:
            async with async_session_factory() as session:
                await seed_rbac(session)
            print("Roles y permisos sincronizados.")
    finally:
        await close_database_engine()


if __name__ == "__main__":
    asyncio.run(main())
