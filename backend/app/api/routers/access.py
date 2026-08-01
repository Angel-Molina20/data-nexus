import uuid

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.api.dependencies import (
    AuthContextDependency,
    CurrentPrincipal,
    require_connection_manager,
    require_csrf,
    require_permission,
    require_sensitive_rate_limit,
)
from app.api.schemas.auth import AccessRequest
from app.domain.connections.errors import PublicError

router = APIRouter(
    prefix="/connections/{connection_id}/access",
    tags=["connection-access"],
    dependencies=[
        Depends(require_csrf),
        Depends(require_permission("connections.manage_access")),
        Depends(require_connection_manager),
        Depends(require_sensitive_rate_limit),
    ],
)


class AccessResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    roles: list[str]
    access_level: str


@router.get("", response_model=list[AccessResponse])
async def list_access(
    connection_id: uuid.UUID, context: AuthContextDependency, _: CurrentPrincipal
) -> list[AccessResponse]:
    result = []
    for access, user in await context.auth.connection_accesses(connection_id):
        result.append(
            AccessResponse(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                roles=[role.code for role in await context.auth.roles_for_user(user.id)],
                access_level=access.access_level,
            )
        )
    return result


@router.put("/{user_id}", response_model=AccessResponse)
async def grant_access(
    connection_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: AccessRequest,
    context: AuthContextDependency,
    principal: CurrentPrincipal,
) -> AccessResponse:
    user = await context.auth.user(user_id)
    if user is None:
        raise PublicError("USER_NOT_FOUND", "El usuario no existe.", 404)
    access = await context.auth.grant_access(
        user_id, connection_id, payload.access_level, principal.user.id
    )
    await context.audit.record(
        action="security.connection_access_grant",
        result="success",
        duration_ms=0,
        actor=principal.user.normalized_email,
        actor_user_id=principal.user.id,
        connection_id=connection_id,
        resource_type="user",
        resource_id=str(user_id),
    )
    await context.session.commit()
    return AccessResponse(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=[role.code for role in await context.auth.roles_for_user(user.id)],
        access_level=access.access_level,
    )


@router.delete("/{user_id}", status_code=204)
async def revoke_access(
    connection_id: uuid.UUID,
    user_id: uuid.UUID,
    context: AuthContextDependency,
    principal: CurrentPrincipal,
) -> Response:
    await context.auth.revoke_access(user_id, connection_id)
    await context.audit.record(
        action="security.connection_access_revoke",
        result="success",
        duration_ms=0,
        actor=principal.user.normalized_email,
        actor_user_id=principal.user.id,
        connection_id=connection_id,
        resource_type="user",
        resource_id=str(user_id),
    )
    await context.session.commit()
    return Response(status_code=204)
