import pytest

from app.domain.connections.errors import PublicError
from app.infrastructure.security.encryption import CredentialEncryption

KEY = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="


def test_encrypt_and_decrypt_without_plaintext_storage() -> None:
    encryption = CredentialEncryption(KEY)
    encrypted = encryption.encrypt_secret("sensitive-password")
    assert "sensitive-password" not in encrypted
    assert encryption.decrypt_secret(encrypted) == "sensitive-password"


def test_invalid_key_fails_controlled() -> None:
    with pytest.raises(RuntimeError, match="no es válida"):
        CredentialEncryption("invalid")


def test_invalid_token_has_safe_error() -> None:
    with pytest.raises(PublicError) as raised:
        CredentialEncryption(KEY).decrypt_secret("not-a-token")
    assert raised.value.code == "INTERNAL_ERROR"
