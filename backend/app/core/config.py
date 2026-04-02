import re
from pydantic_settings import BaseSettings
from functools import lru_cache


def _fix_db_url(url: str) -> str:
    """Convert standard postgres:// URL to asyncpg format and strip unsupported params."""
    # Replace scheme
    url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    # Strip sslmode query param (asyncpg handles SSL via connect_args, not URL)
    url = re.sub(r"[?&]sslmode=[^&]*", "", url)
    url = re.sub(r"[?&]$", "", url)
    return url


class Settings(BaseSettings):
    # Database — default uses local hostnames, overridden by Replit env vars
    DATABASE_URL: str = "postgresql+asyncpg://pam_user:pam_pass@localhost:5432/pam_db"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # Vault
    VAULT_ADDR: str = "http://localhost:8200"
    VAULT_TOKEN: str = "root-dev-token"
    VAULT_SECRET_MOUNT: str = "secret"

    # JWT
    SECRET_KEY: str = "changeme-in-production-use-32-char-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # OTP TTL for caller verification
    OTP_TTL_SECONDS: int = 300

    def model_post_init(self, __context):
        object.__setattr__(self, "DATABASE_URL", _fix_db_url(self.DATABASE_URL))

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
