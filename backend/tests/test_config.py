from app.core.config import Settings


def test_settings_build_service_urls_without_exposing_them() -> None:
    settings = Settings(
        POSTGRES_HOST="postgres",
        POSTGRES_PORT=5432,
        POSTGRES_DB="datanexus_test",
        POSTGRES_USER="test_user",
        POSTGRES_PASSWORD="test_password",
        REDIS_HOST="redis",
        REDIS_PORT=6379,
        CORS_ORIGINS="http://localhost:5173,http://localhost:4173",
    )

    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.database_url.endswith("@postgres:5432/datanexus_test")
    assert settings.redis_url == "redis://redis:6379/0"
    assert settings.CORS_ORIGINS == [
        "http://localhost:5173",
        "http://localhost:4173",
    ]
