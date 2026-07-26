from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.domain.connections.errors import PublicError


class CredentialEncryption:
    def __init__(self, key: str) -> None:
        try:
            self._fernet = Fernet(key.encode())
        except (TypeError, ValueError) as error:
            raise RuntimeError("La clave de cifrado de credenciales no es válida.") from error

    def encrypt_secret(self, value: str) -> str:
        return self._fernet.encrypt(value.encode()).decode()

    def decrypt_secret(self, value: str) -> str:
        try:
            return self._fernet.decrypt(value.encode()).decode()
        except (InvalidToken, ValueError) as error:
            raise PublicError(
                code="INTERNAL_ERROR",
                message="No fue posible acceder a las credenciales almacenadas.",
                status_code=500,
            ) from error


@lru_cache
def get_credential_encryption() -> CredentialEncryption:
    return CredentialEncryption(get_settings().CREDENTIAL_ENCRYPTION_KEY)
