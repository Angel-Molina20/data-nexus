from functools import lru_cache
from typing import Annotated, Literal

from pydantic import BeforeValidator, Field, PostgresDsn, RedisDsn
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
