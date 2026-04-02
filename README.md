# SecureDesk PAM

A fully dockerized, CyberArk-style **Just-In-Time Privileged Access Management** prototype — built to demonstrate how proper helpdesk verification procedures defend against social engineering attacks like the [MGM 2023 breach](https://en.wikipedia.org/wiki/2023_MGM_Resorts_cyberattack).

---

## Architecture

```
Browser
  └─ Nginx :80
       ├─ /       → React frontend  (Vite + React 18)
       └─ /api/*  → FastAPI backend (Python 3.12)
                        ├─ PostgreSQL  (users, requests, audit log)
                        ├─ HashiCorp Vault  (secrets storage)
                        └─ Redis + Celery  (TTL revocation worker)
```

**All 8 containers — zero cloud, zero cost.**

---

## Quick Start

### Prerequisites
- Docker Desktop (or Docker Engine + Compose v2)
- Ports 80 and 8200 free on your machine

### 1. Clone & run

```bash
git clone <your-repo>
cd securedesk-pam
docker compose up --build
```

First build takes 3–5 minutes (npm install + pip install). Subsequent starts are instant.

### 2. Open the app

| URL | Description |
|-----|-------------|
| http://localhost | SecureDesk UI |
| http://localhost:8200 | HashiCorp Vault UI (token: `root-dev-token`) |
| http://localhost/api/docs | FastAPI Swagger UI |

### 3. Demo credentials

All demo passwords: **`password123`**

| Username | Role | What they can do |
|----------|------|-----------------|
| `alice` | User | Submit access requests, checkout tokens, self-revoke |
| `bob` | Approver | Review queue, issue OTPs, verify callers, approve/reject |
| `admin` | Admin | Everything above |

---

## Full Workflow Walkthrough

### Step 1 — User submits a request (login as `alice`)

1. Go to http://localhost → log in as `alice`
2. Click **New Request**
3. Pick a resource (e.g. "Production DB credentials")
4. Fill in a justification: *"Need to run emergency query for incident #1234"*
5. Set TTL (e.g. 1 hour)
6. Submit

### Step 2 — Approver verifies identity (login as `bob` in another tab)

1. Log in as `bob` → lands on **Approver Queue**
2. Click alice's request
3. **Identity Verification tab:**
   - Click **"Issue verification OTP"** — a 6-digit code appears
   - *In a real scenario: call alice on her known phone number and read the code*
   - *In demo: copy the code and paste it into the "Enter code" field below*
   - Click **Verify Identity** — shows ✓ confirmed
4. **Approve tab:**
   - Select duration (may be less than alice requested)
   - Add optional notes
   - Click **Approve Request**

### Step 3 — User checks out the secret (back to `alice`)

1. In alice's dashboard, the request now shows **approved** badge
2. Click **Checkout** → a modal appears with the scoped Vault token
3. Click the eye icon to reveal the token
4. A live countdown shows the TTL draining in real time
5. Use the token with the Vault API to read the actual secret

### Step 4 — Auto-revocation

- When TTL expires, Celery automatically revokes the Vault token and marks the request `expired`
- Alice can also click **Revoke** to early-terminate her own session
- Bob or admin can revoke any active session from the approver panel

### Step 5 — Audit log (as `bob` or `admin`)

- Go to **Audit Log** — every event is listed chronologically
- Click any event to expand its details payload
- Every OTP issue, verification, approval, checkout, and revocation is recorded

---

## Pre-seeded Vault Secrets

The `vault_setup` container seeds these paths automatically on first run:

| Path | Contents |
|------|----------|
| `secret/data/prod/database` | DB username, password, host, port |
| `secret/data/prod/api-keys` | Stripe, SendGrid, Datadog keys (demo) |
| `secret/data/prod/ssh-keys` | SSH private key placeholder |
| `secret/data/staging/database` | Staging DB credentials |
| `secret/data/infra/aws-credentials` | AWS access key + secret (demo) |

Browse them at http://localhost:8200 (token: `root-dev-token`).

---

## Security Design Decisions

### Why OTP caller verification?

Recreating CyberArk's Caller Verification feature. When a user calls the helpdesk:
1. The approver issues a one-time code valid for 5 minutes
2. The code is displayed **only in the approver's browser** — never sent via SMS or email
3. The user must read it back verbally — proving they are physically present with their device
4. Only after successful verification can the approver proceed

This directly prevents the MGM-style attack: an attacker who calls the helpdesk cannot obtain the OTP because it's never transmitted through a channel they control.

### Zero standing privileges

- No user has standing access to any secret
- Every access is gated behind: request → verification → approval → time-limited checkout
- Vault tokens are **scoped** — each checkout creates a token that can only read that one specific path
- Tokens auto-expire and are actively revoked by Celery, not just abandoned

### Audit trail

Every action — including failed OTP attempts — writes to an immutable `audit_log` table. The table has no UPDATE or DELETE permissions in production; it is append-only.

### What this prototype skips (production gaps)

| Gap | Production solution |
|-----|-------------------|
| Vault dev mode (in-memory) | Vault with Raft storage, TLS, AppRole auth |
| Root token used by backend | Vault Agent sidecar with AppRole + token renewal |
| No email/Slack notifications | Add a notification service triggered on status changes |
| Plaintext OTP in DB | OTP should be hashed (bcrypt) same as passwords |
| Single Nginx instance | Add cert-manager + Let's Encrypt for HTTPS |
| No rate limiting | Add slowapi rate limiting on auth endpoints |
| Demo seed users | Proper user onboarding with email verification |

---

## Useful Commands

```bash
# Start everything
docker compose up --build

# Start in background
docker compose up -d --build

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f celery_worker

# Stop everything
docker compose down

# Full reset (wipes Postgres + Vault data)
docker compose down -v

# Open a shell in the backend
docker compose exec backend bash

# Run a Vault CLI command
docker compose exec vault vault kv list secret/

# List all secrets in Vault
docker compose exec vault vault kv list secret/prod

# Read a secret directly
docker compose exec vault vault kv get secret/prod/database

# Check Celery worker status
docker compose exec celery_worker celery -A app.celery_app inspect active
```

---

## Project Structure

```
securedesk-pam/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── postgres/
│   └── init.sql              # Schema + seed users
├── scripts/
│   └── vault_init.sh         # Seeds Vault secrets + policies
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # FastAPI app + lifespan
│       ├── celery_app.py     # TTL revocation worker
│       ├── core/
│       │   ├── config.py     # Settings (pydantic-settings)
│       │   ├── database.py   # Async SQLAlchemy engine
│       │   └── security.py   # JWT + bcrypt + role guards
│       ├── models/
│       │   ├── user.py       # User ORM model
│       │   └── request.py    # AccessRequest, OTPChallenge, AuditLog
│       ├── schemas/
│       │   └── schemas.py    # Pydantic request/response schemas
│       ├── services/
│       │   ├── vault_service.py   # JIT token creation + revocation
│       │   └── audit_service.py  # Immutable audit log writer
│       └── api/
│           ├── auth.py        # Login, /me, register
│           └── requests.py    # Full PAM flow (8 endpoints)
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx            # Router + auth guards
        ├── index.css          # Dark industrial design system
        ├── main.jsx
        ├── store/
        │   └── authStore.js   # Zustand auth state
        ├── services/
        │   └── api.js         # Axios client + interceptors
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── NewRequestPage.jsx
        │   └── AuditLogPage.jsx
        └── components/
            ├── shared/
            │   ├── Layout.jsx       # Sidebar nav shell
            │   └── StatusBadge.jsx  # Badge, TTL countdown, OTP display
            ├── user/
            │   ├── UserDashboard.jsx
            │   └── CheckoutModal.jsx
            └── approver/
                └── ApproverQueue.jsx  # Full verify → approve flow
```

---

## API Reference

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Any | Get JWT token |
| GET | `/auth/me` | Any | Current user info |
| POST | `/auth/register` | Any | Create user (demo) |
| POST | `/requests` | User | Submit access request |
| GET | `/requests` | Any | List requests (scoped by role) |
| GET | `/requests/{id}` | Any | Get single request |
| POST | `/requests/{id}/otp` | Approver | Issue caller verification OTP |
| POST | `/requests/{id}/verify-otp` | Approver | Verify OTP → mark caller confirmed |
| POST | `/requests/{id}/approve` | Approver | Approve + set TTL |
| POST | `/requests/{id}/reject` | Approver | Reject with reason |
| POST | `/requests/{id}/checkout` | User | Get scoped Vault token |
| POST | `/requests/{id}/revoke` | User/Approver | Early revocation |
| GET | `/requests/admin/audit` | Approver/Admin | Full audit log |
