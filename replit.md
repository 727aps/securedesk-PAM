# SecureDesk PAM

A CyberArk-style **Just-In-Time Privileged Access Management** prototype that demonstrates how proper helpdesk verification procedures defend against social engineering attacks (like the MGM 2023 breach).

## Architecture

- **Frontend**: React 18 + Vite (port 5000 in dev)
- **Backend**: FastAPI + SQLAlchemy async (port 8000 in dev)
- **Database**: PostgreSQL (Replit built-in)
- **Optional**: HashiCorp Vault (JIT secrets), Redis + Celery (TTL revocation)

The frontend proxies `/api/*` requests to the backend via Vite's dev proxy.

## Development

The app starts with `bash start.sh` which launches both backend and frontend concurrently:
- Backend: `uvicorn app.main:app --host localhost --port 8000`
- Frontend: `vite` on port 5000 (proxying `/api` to backend)

## Demo Credentials

All demo passwords: **`password123`**

| Username | Role      |
|----------|-----------|
| `alice`  | User      |
| `bob`    | Approver  |
| `admin`  | Admin     |

## Key Files

- `backend/app/main.py` — FastAPI app entrypoint
- `backend/app/core/config.py` — Settings (reads env vars, fixes DB URL format)
- `backend/app/api/auth.py` — Login, /me, register
- `backend/app/api/requests.py` — Full PAM flow (8 endpoints)
- `backend/app/services/vault_service.py` — Vault integration (gracefully degrades to mock tokens if Vault unavailable)
- `frontend/src/App.jsx` — React router + auth guards
- `frontend/vite.config.js` — Vite config (port 5000, proxy to backend)
- `start.sh` — Dev startup script

## Environment Variables

Set automatically by Replit:
- `DATABASE_URL` — PostgreSQL connection (automatically converted to asyncpg format)

Set manually:
- `VAULT_ADDR` — HashiCorp Vault address (default: `http://localhost:8200`)
- `VAULT_TOKEN` — Vault root token (default: `root-dev-token`)
- `SECRET_KEY` — JWT signing key
- `REDIS_URL` — Redis for Celery (default: `redis://localhost:6379/0`)

## Vault / Redis

These services are optional. If Vault is unavailable, the app issues demo mock tokens instead of real scoped Vault tokens. If Redis is unavailable, revocation is performed directly instead of via Celery.

## Database Schema

Initialized via `postgres/init.sql`. Tables: `users`, `access_requests`, `audit_log`, `otp_challenges`. Demo users (alice, bob, admin) are seeded automatically.
