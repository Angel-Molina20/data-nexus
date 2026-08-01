import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies import (
    AuthContextDependency,
    CurrentPrincipal,
    require_csrf,
    require_permission,
    require_sensitive_rate_limit,
)
from app.api.schemas.auth import (
    IdListRequest,
    ResetPasswordRequest,
    UserCreateRequest,
    UserResponse,
    UserUpdateRequest,
)
from app.application.admin import CreateUserService, UserLifecycleService, user_response

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_csrf), Depends(require_sensitive_rate_limit)],
)


@router.get(
    "", response_model=list[UserResponse], dependencies=[Depends(require_permission("users.read"))]
)
async def list_users(
    context: AuthContextDependency,
    _: CurrentPrincipal,
    search: str | None = None,
    status: Annotated[str | None, Query()] = None,
) -> list[UserResponse]:
    return [await user_response(context, item) for item in await context.auth.users(search, status)]


@router.post(
    "",
    response_model=UserResponse,
    status_code=201,
    dependencies=[Depends(require_permission("users.create"))],
)
async def create_user(
    payload: UserCreateRequest, context: AuthContextDependency, principal: CurrentPrincipal
) -> UserResponse:
    return await CreateUserService(context).execute(payload, principal)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users.read"))],
)
async def get_user(
    user_id: uuid.UUID, context: AuthContextDependency, _: CurrentPrincipal
) -> UserResponse:
    return await user_response(context, await UserLifecycleService(context).require_user(user_id))


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users.update"))],
)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    context: AuthContextDependency,
    principal: CurrentPrincipal,
) -> UserResponse:
    lifecycle = UserLifecycleService(context)
    user = await lifecycle.require_user(user_id)
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.status is not None and payload.status != user.status:
        return await lifecycle.set_status(user_id, payload.status, principal)
    await context.session.commit()
    return await user_response(context, user)


@router.post(
    "/{user_id}/activate",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users.update"))],
)
async def activate_user(
    user_id: uuid.UUID, context: AuthContextDependency, principal: CurrentPrincipal
) -> UserResponse:
    return await UserLifecycleService(context).set_status(user_id, "active", principal)


@router.post(
    "/{user_id}/disable",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users.disable"))],
)
async def disable_user(
    user_id: uuid.UUID, context: AuthContextDependency, principal: CurrentPrincipal
) -> UserResponse:
    return await UserLifecycleService(context).set_status(user_id, "inactive", principal)


@router.post(
    "/{user_id}/unlock",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users.unlock"))],
)
async def unlock_user(
    user_id: uuid.UUID, context: AuthContextDependency, principal: CurrentPrincipal
) -> UserResponse:
    return await UserLifecycleService(context).set_status(user_id, "active", principal)


@router.post(
    "/{user_id}/reset-password",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users.reset_password"))],
)
async def reset_password(
    user_id: uuid.UUID,
    payload: ResetPasswordRequest,
    context: AuthContextDependency,
    principal: CurrentPrincipal,
) -> UserResponse:
    return await UserLifecycleService(context).reset_password(
        user_id, payload.password, payload.must_change_password, principal
    )


@router.post(
    "/{user_id}/revoke-sessions",
    status_code=204,
    dependencies=[Depends(require_permission("users.revoke_sessions"))],
)
async def revoke_sessions(
    user_id: uuid.UUID, context: AuthContextDependency, _: CurrentPrincipal
) -> Response:
    await context.auth.revoke_sessions(user_id, "administrator_revoked")
    await context.session.commit()
    return Response(status_code=204)


@router.put(
    "/{user_id}/roles",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("roles.manage_permissions"))],
)
async def assign_roles(
    user_id: uuid.UUID, payload: IdListRequest, context: AuthContextDependency, _: CurrentPrincipal
) -> UserResponse:
    user = await UserLifecycleService(context).require_user(user_id)
    await context.auth.set_user_roles(user_id, payload.ids)
    await context.session.commit()
    return await user_response(context, user)
