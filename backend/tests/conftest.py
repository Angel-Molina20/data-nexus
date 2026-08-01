import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault(
    "CREDENTIAL_ENCRYPTION_KEY",
    "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=",
)

from app.db.models.auth import User, UserSession
from app.db.session import async_session_factory
from app.domain.auth.policies import hash_token, new_token
from app.infrastructure.repositories.auth import seed_rbac
from app.infrastructure.security.passwords import password_service
from app.main import app


@pytest.fixture
async def async_client() -> AsyncIterator[AsyncClient]:
    token, csrf = new_token(), new_token()
    async with async_session_factory() as session:
        await seed_rbac(session)
        user = User(
            email=f"test-{token[:8]}@example.test",
            normalized_email=f"test-{token[:8]}@example.test",
            full_name="Test Administrator",
            password_hash=password_service.hash("Test-Password-42!"),
            status="active",
            is_superuser=True,
            must_change_password=False,
            created_by="test",
            updated_by="test",
        )
        session.add(user)
        await session.flush()
        now = datetime.now(UTC)
        session.add(
            UserSession(
                user_id=user.id,
                token_hash=hash_token(token),
                csrf_token_hash=hash_token(csrf),
                ip_address="test",
                user_agent="pytest",
                expires_at=now + timedelta(hours=1),
                absolute_expires_at=now + timedelta(hours=12),
            )
        )
        await session.commit()
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        cookies={"datanexus_session": token, "datanexus_csrf": csrf},
        headers={"X-CSRF-Token": csrf, "Origin": "http://localhost:5173"},
    ) as client:
        yield client
    async with async_session_factory() as session:
        stored = await session.get(User, user.id)
        if stored:
            await session.delete(stored)
            await session.commit()
