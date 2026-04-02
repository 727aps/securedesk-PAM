from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://pam_user:pam_pass@postgres:5432/pam_db"

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"

    # Vault
    VAULT_ADDR: str = "http://vault:8200"
    VAULT_TOKEN: str = "root-dev-token"
    VAULT_SECRET_MOUNT: str = "secret"

    # JWT
    SECRET_KEY: str = "changeme-in-production-use-32-char-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # OTP TTL for caller verification
    OTP_TTL_SECONDS: int = 300

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
