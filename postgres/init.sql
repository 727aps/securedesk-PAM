-- SecureDesk PAM - Database Schema
-- Runs once on first container startup

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(100) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    full_name   VARCHAR(255) NOT NULL,
    hashed_password TEXT NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'user'  -- user | approver | admin
                CHECK (role IN ('user', 'approver', 'admin')),
    department  VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access request table
CREATE TABLE IF NOT EXISTS access_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id    UUID NOT NULL REFERENCES users(id),
    approver_id     UUID REFERENCES users(id),
    -- What they want access to
    system_name     VARCHAR(255) NOT NULL,
    resource_path   VARCHAR(500) NOT NULL,  -- e.g. "secret/data/prod/db-password"
    justification   TEXT NOT NULL,
    -- Timing
    requested_ttl   INTEGER NOT NULL DEFAULT 3600,   -- seconds
    approved_ttl    INTEGER,
    -- Status lifecycle: pending → approved | rejected → active → revoked | expired
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','active','revoked','expired')),
    -- Vault integration
    vault_token     TEXT,
    vault_lease_id  TEXT,
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    activated_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    -- Caller verification
    caller_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_method VARCHAR(50),  -- otp | push | in_person
    -- Approval notes
    approver_notes  TEXT
);

-- Audit log (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id    UUID REFERENCES users(id),
    actor_name  VARCHAR(100),
    event_type  VARCHAR(100) NOT NULL,
    -- e.g. REQUEST_CREATED, CALLER_VERIFIED, REQUEST_APPROVED,
    --       SECRET_CHECKED_OUT, SECRET_REVOKED, REQUEST_REJECTED
    request_id  UUID REFERENCES access_requests(id),
    details     JSONB,
    ip_address  INET,
    user_agent  TEXT
);

-- OTP challenges (ephemeral - for caller verification)
CREATE TABLE IF NOT EXISTS otp_challenges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID NOT NULL REFERENCES access_requests(id),
    otp_code    VARCHAR(8) NOT NULL,
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    used        BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_requests_requester ON access_requests(requester_id);
CREATE INDEX idx_requests_status ON access_requests(status);
CREATE INDEX idx_requests_expires ON access_requests(expires_at) WHERE status = 'active';
CREATE INDEX idx_audit_request ON audit_log(request_id);
CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_time ON audit_log(event_time DESC);

-- ─── Seed demo users ──────────────────────────────────────────────────────
-- Passwords are bcrypt of: "password123"
-- In production, replace these with proper onboarding
INSERT INTO users (username, email, full_name, hashed_password, role, department) VALUES
(
    'alice',
    'alice@example.com',
    'Alice Chen',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'user',
    'Engineering'
),
(
    'bob',
    'bob@example.com',
    'Bob Martinez',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'approver',
    'IT Security'
),
(
    'admin',
    'admin@example.com',
    'SecureDesk Admin',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'admin',
    'IT Security'
)
ON CONFLICT DO NOTHING;
