import uuid

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.dependencies import (
    AuthContextDependency,
    CurrentPrincipal,
    require_csrf,
    require_sensitive_rate_limit,
)
from app.api.schemas.auth import (
    ChangePasswordRequest,
    CsrfResponse,
    CurrentUserResponse,
    LoginRequest,
    SessionResponse,
)
from app.application.auth import ChangePasswordService, LoginService, SessionService
from app.domain.auth.policies import token_matches
from app.domain.connections.errors import PublicError

router = APIRouter(prefix="/auth", tags=["authentication"])


def profile(principal: CurrentPrincipal) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=principal.user.id,
        email=principal.user.email,
        full_name=principal.user.full_name,
        status=principal.user.status,
        roles=principal.roles,
        permissions=sorted(principal.permissions),
        must_change_password=principal.user.must_change_password,
    )


def set_auth_cookies(
    response: Response, context: AuthContextDependency, token: str, csrf: str
) -> None:
    for name, value in (
        (context.settings.SESSION_COOKIE_NAME, token),
        (context.settings.CSRF_COOKIE_NAME, csrf),
    ):
        response.set_cookie(
            name,
            value,
            httponly=True,
            secure=context.settings.SESSION_COOKIE_SECURE,
            samesite=context.settings.SESSION_COOKIE_SAMESITE,
            domain=context.settings.SESSION_COOKIE_DOMAIN,
            path="/",
            max_age=context.settings.SESSION_ABSOLUTE_TIMEOUT_HOURS * 3600,
        )


def clear_auth_cookies(response: Response, context: AuthContextDependency) -> None:
    for name in (context.settings.SESSION_COOKIE_NAME, context.settings.CSRF_COOKIE_NAME):
        response.delete_cookie(
            name,
            path="/",
            domain=context.settings.SESSION_COOKIE_DOMAIN,
            secure=context.settings.SESSION_COOKIE_SECURE,
            samesite=context.settings.SESSION_COOKIE_SAMESITE,
        )


@router.post("/login", response_model=CurrentUserResponse)
async def login(
    payload: LoginRequest, request: Request, response: Response, context: AuthContextDependency
) -> CurrentUserResponse:
    principal, token, csrf = await LoginService(context).execute(
        payload.email,
        payload.password,
        request.client.host if request.client else "unknown",
        request.headers.get("user-agent", "unknown"),
    )
    set_auth_cookies(response, context, token, csrf)
    return profile(principal)


@router.get("/me", response_model=CurrentUserResponse)
async def me(principal: CurrentPrincipal) -> CurrentUserResponse:
    return profile(principal)


@router.get("/csrf", response_model=CsrfResponse)
async def csrf(
    principal: CurrentPrincipal,
    context: AuthContextDependency,
    request: Request,
) -> CsrfResponse:
    csrf_cookie = request.cookies.get(context.settings.CSRF_COOKIE_NAME)
    if csrf_cookie is None or not token_matches(csrf_cookie, principal.session.csrf_token_hash):
        raise PublicError("CSRF_TOKEN_INVALID", "No fue posible obtener el token CSRF.", 403)
    return CsrfResponse(csrf_token=csrf_cookie)


@router.post(
    "/logout", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_csrf)]
)
async def logout(
    response: Response, context: AuthContextDependency, principal: CurrentPrincipal
) -> Response:
    await SessionService(context).logout(principal)
    clear_auth_cookies(response, context)
    return Response(status_code=204, headers=response.headers)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_csrf), Depends(require_sensitive_rate_limit)],
)
async def change_password(
    payload: ChangePasswordRequest, context: AuthContextDependency, principal: CurrentPrincipal
) -> Response:
    await ChangePasswordService(context).execute(
        principal, payload.current_password, payload.new_password
    )
    return Response(status_code=204)


@router.post(
    "/logout-all", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_csrf)]
)
async def logout_all(
    response: Response, context: AuthContextDependency, principal: CurrentPrincipal
) -> Response:
    await context.auth.revoke_sessions(principal.user.id, "logout_all")
    await context.session.commit()
    clear_auth_cookies(response, context)
    return Response(status_code=204, headers=response.headers)


@router.get("/sessions", response_model=list[SessionResponse])
async def sessions(
    context: AuthContextDependency, principal: CurrentPrincipal
) -> list[SessionResponse]:
    return [
        SessionResponse(
            id=item.id,
            created_at=item.created_at,
            last_seen_at=item.last_seen_at,
            expires_at=item.expires_at,
            ip_address=item.ip_address,
            current=item.id == principal.session.id,
        )
        for item in await context.auth.sessions(principal.user.id)
    ]


@router.delete("/sessions/{session_id}", status_code=204, dependencies=[Depends(require_csrf)])
async def revoke_session(
    session_id: uuid.UUID, context: AuthContextDependency, principal: CurrentPrincipal
) -> Response:
    sessions_list = await context.auth.sessions(principal.user.id)
    target = next((item for item in sessions_list if item.id == session_id), None)
    if target is None:
        raise PublicError("SESSION_NOT_FOUND", "La sesión no existe.", 404)
    target.is_active = False
    target.revoked_reason = "user_revoked"
    await context.session.commit()
    return Response(status_code=204)
