#!/bin/sh
# Vault initialization script — runs once on first startup
# Seeds KV v2 engine, demo secrets, and base policies

set -e
echo "==> Waiting for Vault to be ready..."
sleep 3

export VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
export VAULT_TOKEN="${VAULT_TOKEN:-root-dev-token}"

echo "==> Enabling KV v2 secrets engine..."
vault secrets enable -version=2 -path=secret kv 2>/dev/null || echo "KV already enabled"

echo "==> Seeding demo secrets..."

vault kv put secret/prod/database \
  username="prod_db_admin" \
  password="Sup3rS3cr3tDBPass!" \
  host="prod-postgres.internal" \
  port="5432" \
  database="production_app"

vault kv put secret/prod/api-keys \
  stripe_secret="sk_live_DEMO_REPLACE_ME" \
  sendgrid_api_key="SG.DEMO_REPLACE_ME" \
  datadog_api_key="dd_api_DEMO_REPLACE_ME"

vault kv put secret/prod/ssh-keys \
  private_key="-----BEGIN RSA PRIVATE KEY----- (demo placeholder)" \
  passphrase="demo-ssh-passphrase"

vault kv put secret/staging/database \
  username="staging_db_user" \
  password="StagingPass123!" \
  host="staging-postgres.internal" \
  port="5432" \
  database="staging_app"

vault kv put secret/infra/aws-credentials \
  access_key_id="AKIAIOSFODNN7EXAMPLE" \
  secret_access_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" \
  region="us-east-1"

echo "==> Creating base read policy..."
vault policy write jit-base - <<EOF
# Base JIT policy — scoped policies are created dynamically per request
path "secret/data/*" {
  capabilities = ["read"]
}
path "secret/metadata/*" {
  capabilities = ["read", "list"]
}
EOF

echo "==> Vault initialization complete."
vault kv list secret/ || true
