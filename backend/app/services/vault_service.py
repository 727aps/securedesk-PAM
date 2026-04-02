"""
Vault service — wraps hvac to provide JIT secret checkout,
time-limited token creation, and lease revocation.
"""
import logging
import hvac
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def get_vault_client() -> hvac.Client:
    client = hvac.Client(url=settings.VAULT_ADDR, token=settings.VAULT_TOKEN)
    if not client.is_authenticated():
        raise RuntimeError("Vault authentication failed — check VAULT_TOKEN")
    return client


def ensure_secret_exists(path: str, default_data: dict | None = None) -> None:
    """Seed a secret in Vault if it doesn't exist yet (demo only)."""
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
        logger.info(f"Seeded demo secret at {path}")


def create_limited_token(ttl_seconds: int, resource_path: str) -> dict:
    """
    Create a Vault token with a specific TTL and policy
    restricted to reading only the requested path.
    Returns {"token": "...", "lease_id": "..."}
    """
    client = get_vault_client()

    # Create an inline policy scoped to just this path
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

    # Create a short-lived child token
    token_response = client.auth.token.create(
        policies=[policy_name],
        ttl=f"{ttl_seconds}s",
        renewable=False,
        explicit_max_ttl=f"{ttl_seconds}s",
        no_parent=True,  # orphan token — won't be revoked if root rotates
    )

    vault_token = token_response["auth"]["client_token"]
    accessor = token_response["auth"]["accessor"]

    logger.info(f"Created JIT Vault token accessor={accessor} ttl={ttl_seconds}s path={resource_path}")
    return {
        "token": vault_token,
        "accessor": accessor,
        "ttl": ttl_seconds,
        "policy": policy_name,
    }


def read_secret(vault_token: str, resource_path: str) -> dict:
    """Read a secret using a user's scoped Vault token."""
    client = hvac.Client(url=settings.VAULT_ADDR, token=vault_token)
    response = client.secrets.kv.v2.read_secret_version(
        path=resource_path,
        mount_point=settings.VAULT_SECRET_MOUNT,
    )
    return response["data"]["data"]


def revoke_token(vault_token: str) -> bool:
    """Revoke a Vault token immediately (called by TTL worker or manual revoke)."""
    try:
        client = get_vault_client()
        client.auth.token.revoke(vault_token)
        logger.info("Revoked Vault token")
        return True
    except Exception as e:
        logger.warning(f"Token revocation failed (may already be expired): {e}")
        return False


def check_token_valid(vault_token: str) -> bool:
    """Check if a Vault token is still alive."""
    try:
        client = hvac.Client(url=settings.VAULT_ADDR, token=vault_token)
        return client.is_authenticated()
    except Exception:
        return False
