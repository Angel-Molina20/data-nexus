from functools import lru_cache
from typing import Annotated, Literal

from pydantic import BeforeValidator, Field, PostgresDsn, RedisDsn, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def parse_cors_origins(value: object) -> object:
    if isinstance(value, str):
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    return value


CorsOrigins = Annotated[list[str], NoDecode, BeforeValidator(parse_cors_origins)]
StringList = Annotated[list[str], NoDecode, BeforeValidator(parse_cors_origins)]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    APP_NAME: str = "DataNexus"
    APP_ENV: Literal["development", "test", "staging", "production"] = "development"
    APP_DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = Field(default=8000, ge=1, le=65535)

    POSTGRES_HOST: str
    POSTGRES_PORT: int = Field(ge=1, le=65535)
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str

    REDIS_HOST: str
    REDIS_PORT: int = Field(ge=1, le=65535)
    CORS_ORIGINS: CorsOrigins = ["http://localhost:5173"]
    CREDENTIAL_ENCRYPTION_KEY: str
    MYSQL_CONNECT_TIMEOUT: int = Field(default=10, ge=1, le=60)
    MYSQL_READ_TIMEOUT: int = Field(default=15, ge=1, le=300)
    MYSQL_WRITE_TIMEOUT: int = Field(default=15, ge=1, le=300)
    ALLOW_PRIVATE_DATABASE_HOSTS: bool = True
    ALLOWED_DATABASE_HOSTS: StringList = ["mysql56", "mysql8"]
    BLOCKED_DATABASE_HOSTS: StringList = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "169.254.169.254",
        "::1",
    ]
    ENABLE_API_DOCS: bool = True
    SCHEMA_SYNC_TIMEOUT_SECONDS: int = Field(default=60, ge=5, le=900)
    SCHEMA_SYNC_MAX_ENTITIES: int = Field(default=5000, ge=1, le=100000)
    SCHEMA_SYNC_INCLUDE_VIEWS: bool = True
    SCHEMA_SYNC_INCLUDE_SYSTEM_SCHEMAS: bool = False
    RELATIONSHIP_DETECTION_ENABLED: bool = True
    RELATIONSHIP_MIN_CONFIDENCE: float = Field(default=0.50, ge=0, le=1)
    RELATIONSHIP_MAX_CANDIDATES: int = Field(default=1000, ge=1, le=10000)
    RELATIONSHIP_MAX_COMPOSITE_FIELDS: int = Field(default=8, ge=1, le=32)
    POLYMORPHIC_MAX_MAPPINGS: int = Field(default=100, ge=1, le=1000)
    ENABLE_POLYMORPHIC_VALUE_DISCOVERY: bool = False
    POLYMORPHIC_VALUE_DISCOVERY_LIMIT: int = Field(default=100, ge=1, le=1000)
    POLYMORPHIC_VALUE_DISCOVERY_TIMEOUT_SECONDS: int = Field(default=10, ge=1, le=60)
    PASSWORD_MIN_LENGTH: int = Field(default=12, ge=8, le=128)
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_NUMBER: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True
    SESSION_IDLE_TIMEOUT_MINUTES: int = Field(default=60, ge=5, le=1440)
    SESSION_ABSOLUTE_TIMEOUT_HOURS: int = Field(default=12, ge=1, le=720)
    SESSION_COOKIE_NAME: str = "datanexus_session"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    SESSION_COOKIE_DOMAIN: str | None = None
    MAX_FAILED_LOGIN_ATTEMPTS: int = Field(default=5, ge=1, le=100)
    ACCOUNT_LOCK_MINUTES: int = Field(default=15, ge=1, le=1440)
    LOGIN_RATE_LIMIT_PER_MINUTE: int = Field(default=5, ge=1, le=1000)
    LOGIN_ACCOUNT_RATE_LIMIT_PER_15_MINUTES: int = Field(default=10, ge=1, le=1000)
    CSRF_COOKIE_NAME: str = "datanexus_csrf"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"
    ALLOWED_ORIGINS: CorsOrigins = ["http://localhost:5173"]
    ENABLE_BOOTSTRAP_ADMIN: bool = False
    BOOTSTRAP_ADMIN_EMAIL: str | None = None
    BOOTSTRAP_ADMIN_NAME: str | None = None
    BOOTSTRAP_ADMIN_PASSWORD: str | None = None

    @model_validator(mode="after")
    def secure_production_session(self) -> "Settings":
        if self.APP_ENV == "production" and not self.SESSION_COOKIE_SECURE:
            raise ValueError("SESSION_COOKIE_SECURE debe activarse en producción")
        return self

    @property
    def database_url(self) -> str:
        return str(
            PostgresDsn.build(
                scheme="postgresql+psycopg",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PASSWORD,
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                path=self.POSTGRES_DB,
            )
        )

    @property
    def redis_url(self) -> str:
        return str(
            RedisDsn.build(
                scheme="redis",
                host=self.REDIS_HOST,
                port=self.REDIS_PORT,
            )
        )

    @property
    def api_docs_enabled(self) -> bool:
        return self.ENABLE_API_DOCS and self.APP_ENV != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
