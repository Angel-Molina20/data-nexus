import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select

from app.api.dependencies import (
    AuthContextDependency,
    CurrentPrincipal,
    require_csrf,
    require_permission,
    require_sensitive_rate_limit,
)
from app.api.schemas.auth import IdListRequest, PermissionResponse, RoleRequest, RoleResponse
from app.db.models.auth import Permission, Role, RolePermission
from app.domain.connections.errors import PublicError

router = APIRouter(
    tags=["roles"], dependencies=[Depends(require_csrf), Depends(require_sensitive_rate_limit)]
)


async def role_response(context: AuthContextDependency, role: Role) -> RoleResponse:
    permissions = await context.auth.all_permissions()
    effective = set(
        (
            await context.session.scalars(
                select(Permission.code)
                .join(RolePermission)
                .where(RolePermission.role_id == role.id)
            )
        ).all()
    )
    return RoleResponse(
        id=role.id,
        code=role.code,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        permissions=[item.code for item in permissions if item.code in effective],
    )


@router.get(
    "/roles",
    response_model=list[RoleResponse],
    dependencies=[Depends(require_permission("roles.read"))],
)
async def list_roles(context: AuthContextDependency, _: CurrentPrincipal) -> list[RoleResponse]:
    return [await role_response(context, item) for item in await context.auth.all_roles()]


@router.post(
    "/roles",
    response_model=RoleResponse,
    status_code=201,
    dependencies=[Depends(require_permission("roles.create"))],
)
async def create_role(
    payload: RoleRequest, context: AuthContextDependency, _: CurrentPrincipal
) -> RoleResponse:
    if any(item.code == payload.code for item in await context.auth.all_roles()):
        raise PublicError("ROLE_ALREADY_EXISTS", "Ya existe un rol con ese código.", 409)
    role = Role(
        code=payload.code, name=payload.name, description=payload.description, is_system=False
    )
    context.session.add(role)
    await context.session.commit()
    return await role_response(context, role)


@router.get(
    "/roles/{role_id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("roles.read"))],
)
async def get_role(
    role_id: uuid.UUID, context: AuthContextDependency, _: CurrentPrincipal
) -> RoleResponse:
    role = await context.auth.role(role_id)
    if role is None:
        raise PublicError("ROLE_NOT_FOUND", "El rol no existe.", 404)
    return await role_response(context, role)


@router.patch(
    "/roles/{role_id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("roles.update"))],
)
async def update_role(
    role_id: uuid.UUID, payload: RoleRequest, context: AuthContextDependency, _: CurrentPrincipal
) -> RoleResponse:
    role = await context.auth.role(role_id)
    if role is None:
        raise PublicError("ROLE_NOT_FOUND", "El rol no existe.", 404)
    if role.is_system and role.code != payload.code:
        raise PublicError(
            "PERMISSION_DENIED", "El código de un rol del sistema no puede cambiar.", 403
        )
    role.code, role.name, role.description = payload.code, payload.name, payload.description
    await context.session.commit()
    return await role_response(context, role)


@router.delete(
    "/roles/{role_id}", status_code=204, dependencies=[Depends(require_permission("roles.delete"))]
)
async def delete_role(
    role_id: uuid.UUID, context: AuthContextDependency, _: CurrentPrincipal
) -> Response:
    role = await context.auth.role(role_id)
    if role is None:
        raise PublicError("ROLE_NOT_FOUND", "El rol no existe.", 404)
    if role.is_system:
        raise PublicError("PERMISSION_DENIED", "Los roles del sistema no pueden eliminarse.", 403)
    await context.session.delete(role)
    await context.session.commit()
    return Response(status_code=204)


@router.get(
    "/permissions",
    response_model=list[PermissionResponse],
    dependencies=[Depends(require_permission("roles.read"))],
)
async def list_permissions(
    context: AuthContextDependency, _: CurrentPrincipal
) -> list[PermissionResponse]:
    return [
        PermissionResponse(
            id=item.id,
            code=item.code,
            name=item.name,
            description=item.description,
            resource_type=item.resource_type,
        )
        for item in await context.auth.all_permissions()
    ]


@router.put(
    "/roles/{role_id}/permissions",
    response_model=RoleResponse,
    dependencies=[Depends(require_permission("roles.manage_permissions"))],
)
async def assign_permissions(
    role_id: uuid.UUID, payload: IdListRequest, context: AuthContextDependency, _: CurrentPrincipal
) -> RoleResponse:
    role = await context.auth.role(role_id)
    if role is None:
        raise PublicError("ROLE_NOT_FOUND", "El rol no existe.", 404)
    await context.auth.set_role_permissions(role_id, payload.ids)
    await context.session.commit()
    return await role_response(context, role)
