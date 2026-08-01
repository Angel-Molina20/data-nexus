import pytest

from app.core.config import get_settings
from app.domain.auth.permissions import ACCESS_LEVELS
from app.domain.auth.policies import (
    hash_token,
    new_token,
    normalize_email,
    token_matches,
    validate_password,
)
from app.domain.connections.errors import PublicError
from app.infrastructure.security.passwords import PasswordService


def test_argon2id_hash_verify_and_rehash_contract() -> None:
    service = PasswordService()
    password_hash = service.hash("Strong-Password-42")
    assert password_hash.startswith("$argon2id$")
    assert service.verify(password_hash, "Strong-Password-42")
    assert not service.verify(password_hash, "wrong")
    assert not service.needs_rehash(password_hash)


def test_password_policy_is_centralized() -> None:
    validate_password("Strong-Password-42", get_settings())
    with pytest.raises(PublicError) as error:
        validate_password("weak", get_settings())
    assert error.value.code == "PASSWORD_POLICY_VIOLATION"


def test_email_and_opaque_tokens() -> None:
    assert normalize_email(" Admin@Example.COM ") == "admin@example.com"
    token = new_token()
    hashed = hash_token(token)
    assert token not in hashed
    assert token_matches(token, hashed)
    assert not token_matches(new_token(), hashed)


def test_connection_access_hierarchy() -> None:
    assert ACCESS_LEVELS["viewer"] < ACCESS_LEVELS["analyst"] < ACCESS_LEVELS["manager"]
