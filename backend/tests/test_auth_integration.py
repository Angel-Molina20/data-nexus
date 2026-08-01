from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_anonymous_resources_are_protected_and_login_is_generic() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        protected = await client.get("/api/v1/connections")
        assert protected.status_code == 401
        assert protected.json()["code"] == "AUTHENTICATION_REQUIRED"

        invalid = await client.post(
            "/api/v1/auth/login",
            json={"email": "missing-user@example.com", "password": "Wrong-Password-42!"},
        )
        assert invalid.status_code == 401
        assert invalid.json() == {
            "code": "INVALID_CREDENTIALS",
            "message": "Las credenciales ingresadas no son válidas.",
            "details": None,
        }


async def test_csrf_is_required_for_authenticated_mutations(async_client: AsyncClient) -> None:
    response = await async_client.post(
        "/api/v1/auth/logout",
        headers={"Origin": "http://localhost:5173", "X-CSRF-Token": "invalid"},
    )
    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_TOKEN_INVALID"
