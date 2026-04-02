"""
Vault service — wraps hvac to provide JIT secret checkout,
time-limited token creation, and lease revocation.

If Vault is not available (e.g. running without Docker),
operations degrade gracefully with mock tokens for demo purposes.
"""
import logging
import uuid
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_vault_available = None


def _check_vault_available() -> bool:
    global _vault_available
    if _vault_available is not None:
        return _vault_available
    try:
        import hvac
        client = hvac.Client(url=settings.VAULT_ADDR, token=settings.VAULT_TOKEN)
        _vault_available = client.is_authenticated()
    except Exception:
        _vault_available = False
    if not _vault_available:
        logger.warning(
            "Vault is not available at %s — running in demo mode (mock tokens)",
            settings.VAULT_ADDR,
        )
    return _vault_available


def get_vault_client():
    import hvac
    client = hvac.Client(url=settings.VAULT_ADDR, token=settings.VAULT_TOKEN)
    if not client.is_authenticated():
        raise RuntimeError("Vault authentication failed — check VAULT_TOKEN")
    return client


def ensure_secret_exists(path: str, default_data: dict | None = None) -> None:
    """Seed a secret in Vault if it doesn't exist yet (demo only)."""
    if not _check_vault_available():
        logger.debug("Vault unavailable — skipping ensure_secret_exists for %s", path)
        return
    try:
        import hvac
        client = get_vault_client()
        try:
            client.secrets.kv.v2.read_secret_version(path=path, mount_point=settings.VAULT_SECRET_MOUNT)
        except hvac.exceptions.InvalidPath:
            seed = default_data or {
                "username": "demo_service_account",
                "password": "super-secret-generated-password",
                "host": "prod-db.internal",
                "port": "5432",
            }
            client.secrets.kv.v2.create_or_update_secret(
                path=path,
                secret=seed,
                mount_point=settings.VAULT_SECRET_MOUNT,
            )
            logger.info("Seeded demo secret at %s", path)
    except Exception as e:
        logger.warning("ensure_secret_exists failed (non-fatal): %s", e)


def create_limited_token(ttl_seconds: int, resource_path: str) -> dict:
    """
    Create a Vault token with a specific TTL and policy restricted to reading
    only the requested path.  Falls back to a mock token if Vault is unavailable.
    Returns {"token": "...", "accessor": "...", "ttl": ..., "policy": "..."}
    """
    if not _check_vault_available():
        mock_token = f"demo-token-{uuid.uuid4().hex[:16]}"
        logger.info("Vault unavailable — issuing mock token for demo path=%s", resource_path)
        return {
            "token": mock_token,
            "accessor": f"demo-accessor-{uuid.uuid4().hex[:8]}",
            "ttl": ttl_seconds,
            "policy": f"jit-demo-{resource_path.replace('/', '-')}",
        }

    client = get_vault_client()

    policy_name = f"jit-{resource_path.replace('/', '-')}"
    policy_hcl = f"""
path "{settings.VAULT_SECRET_MOUNT}/data/{resource_path}" {{
  capabilities = ["read"]
}}
path "{settings.VAULT_SECRET_MOUNT}/metadata/{resource_path}" {{
  capabilities = ["read"]
}}
"""
    client.sys.create_or_update_policy(name=policy_name, policy=policy_hcl)

    token_response = client.auth.token.create(
        policies=[policy_name],
        ttl=f"{ttl_seconds}s",
        renewable=False,
        explicit_max_ttl=f"{ttl_seconds}s",
        no_parent=True,
    )

    vault_token = token_response["auth"]["client_token"]
    accessor = token_response["auth"]["accessor"]

    logger.info("Created JIT Vault token accessor=%s ttl=%ss path=%s", accessor, ttl_seconds, resource_path)
    return {
        "token": vault_token,
        "accessor": accessor,
        "ttl": ttl_seconds,
        "policy": policy_name,
    }


def read_secret(vault_token: str, resource_path: str) -> dict:
    """Read a secret using a user's scoped Vault token."""
    if not _check_vault_available() or vault_token.startswith("demo-token-"):
        return {
            "username": "demo_service_account",
            "password": "demo-secret-value",
            "host": "prod-db.internal",
            "port": "5432",
            "note": "Vault unavailable — this is demo data",
        }
    import hvac
    client = hvac.Client(url=settings.VAULT_ADDR, token=vault_token)
    response = client.secrets.kv.v2.read_secret_version(
        path=resource_path,
        mount_point=settings.VAULT_SECRET_MOUNT,
    )
    return response["data"]["data"]


def revoke_token(vault_token: str) -> bool:
    """Revoke a Vault token immediately (called by TTL worker or manual revoke)."""
    if not _check_vault_available() or vault_token.startswith("demo-token-"):
        logger.info("Vault unavailable or demo token — skipping revocation")
        return True
    try:
        client = get_vault_client()
        client.auth.token.revoke(vault_token)
        logger.info("Revoked Vault token")
        return True
    except Exception as e:
        logger.warning("Token revocation failed (may already be expired): %s", e)
        return False


def check_token_valid(vault_token: str) -> bool:
    """Check if a Vault token is still alive."""
    if not _check_vault_available() or vault_token.startswith("demo-token-"):
        return True
    try:
        import hvac
        client = hvac.Client(url=settings.VAULT_ADDR, token=vault_token)
        return client.is_authenticated()
    except Exception:
        return False
