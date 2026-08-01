from redis.asyncio import Redis

from app.core.config import Settings
from app.domain.connections.errors import PublicError


class RateLimiter:
    def __init__(self, redis: Redis, settings: Settings) -> None:
        self.redis = redis
        self.settings = settings

    async def login(self, ip_address: str, normalized_email: str) -> None:
        await self._check(
            f"auth:login:ip:{ip_address}", self.settings.LOGIN_RATE_LIMIT_PER_MINUTE, 60
        )
        await self._check(
            f"auth:login:account:{normalized_email}",
            self.settings.LOGIN_ACCOUNT_RATE_LIMIT_PER_15_MINUTES,
            900,
        )

    async def sensitive(self, actor: str, action: str) -> None:
        await self._check(f"security:sensitive:{actor}:{action}", 30, 60)

    async def _check(self, key: str, limit: int, ttl: int) -> None:
        current = await self.redis.incr(key)
        if current == 1:
            await self.redis.expire(key, ttl)
        if current > limit:
            raise PublicError(
                "RATE_LIMIT_EXCEEDED",
                "Se realizaron demasiados intentos. Inténtalo más tarde.",
                429,
            )
