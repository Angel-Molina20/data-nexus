import hashlib
import hmac
import re
import secrets

from app.core.config import Settings
from app.domain.connections.errors import PublicError


def normalize_email(email: str) -> str:
    return email.strip().casefold()


def validate_password(password: str, settings: Settings) -> None:
    failures: list[str] = []
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        failures.append(f"mínimo {settings.PASSWORD_MIN_LENGTH} caracteres")
    if settings.PASSWORD_REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
        failures.append("una mayúscula")
    if settings.PASSWORD_REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
        failures.append("una minúscula")
    if settings.PASSWORD_REQUIRE_NUMBER and not re.search(r"\d", password):
        failures.append("un número")
    if settings.PASSWORD_REQUIRE_SPECIAL and not re.search(r"[^A-Za-z0-9]", password):
        failures.append("un carácter especial")
    if failures:
        raise PublicError(
            "PASSWORD_POLICY_VIOLATION",
            "La contraseña debe incluir " + ", ".join(failures) + ".",
            422,
        )


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def token_matches(token: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), expected_hash)
