import ipaddress
import socket

from app.domain.connections.errors import PublicError


class DatabaseHostPolicy:
    def __init__(
        self,
        *,
        allow_private: bool,
        allowed_hosts: list[str],
        blocked_hosts: list[str],
    ) -> None:
        self.allow_private = allow_private
        self.allowed_hosts = {host.casefold() for host in allowed_hosts}
        self.blocked_hosts = {host.casefold() for host in blocked_hosts}

    def validate(self, host: str, port: int) -> None:
        normalized = host.strip().casefold()
        if not normalized or not 1 <= port <= 65535 or normalized in self.blocked_hosts:
            self._blocked()
        try:
            addresses = {
                item[4][0]
                for item in socket.getaddrinfo(
                    normalized,
                    port,
                    type=socket.SOCK_STREAM,
                )
            }
        except socket.gaierror as error:
            raise PublicError(
                code="CONNECTION_FAILED",
                message="No fue posible resolver el host indicado.",
                status_code=400,
            ) from error
        if not addresses:
            self._blocked()
        for address in addresses:
            ip = ipaddress.ip_address(address)
            if ip.is_loopback or ip.is_link_local or ip.is_unspecified:
                self._blocked()
            if not self.allow_private and ip.is_private and normalized not in self.allowed_hosts:
                self._blocked()

    @staticmethod
    def _blocked() -> None:
        raise PublicError(
            code="HOST_NOT_ALLOWED",
            message="El host indicado no está permitido por la política de red.",
            status_code=400,
        )
