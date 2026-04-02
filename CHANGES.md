# Deployment Fix Summary

## Issues Identified

1. **Backend not serving frontend in production** - FastAPI ran on port 8000, frontend on 5000 separately
2. **Deployment config missing dependency installation** - Backend dependencies not installed during deployment
3. **API routes not prefixed** - Routes were at root instead of `/api/*`
4. **No static file serving** - Built frontend files weren't being served by the backend
5. **Start script had hardcoded paths** - Wouldn't work in different environments

## Changes Made

### 1. Backend (`backend/app/main.py`)
**Added:**
- Static file serving for production
- Serving built React app from `frontend/dist`
- SPA routing support (all non-API routes return `index.html`)
- API routes now prefixed with `/api`

**Before:**
```python
app.include_router(auth.router)
app.include_router(requests_router.router)
```

**After:**
```python
app.include_router(auth.router, prefix="/api")
app.include_router(requests_router.prefix="/api")

# Serve static files in production
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")))
    # Serve index.html for all other routes
```

### 2. Frontend Config (`frontend/vite.config.js`)
**Changed:**
- Removed API path rewriting (backend now has `/api` prefix)
- Added explicit build configuration

**Before:**
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}
```

**After:**
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
}
build: {
  outDir: 'dist',
  emptyOutDir: true,
}
```

### 3. Deployment Config (`.replit`)
**Changed:**
- Added dependency installation in run command
- Backend now runs on port 5000 (same port for dev and prod)
- Build command installs and builds frontend

**Run command:**
```bash
cd backend &&
pip install --break-system-packages -r requirements.txt &&
DATABASE_URL=$(echo $DATABASE_URL | sed 's|postgresql://|postgresql+asyncpg://|;s|postgres://|postgresql+asyncpg://|;s|[?&]sslmode=[^&]*||')
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

**Build command:**
```bash
cd frontend && npm install && npm run build
```

### 4. Start Script (`start.sh`)
**Improved:**
- Dynamic path resolution
- Automatic dependency installation
- Proper cleanup on exit
- Works in any directory structure

**Added:**
```bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Auto-install dependencies if missing
# Proper signal handling
```

### 5. Documentation
**Created:**
- `DEPLOYMENT.md` - Complete deployment guide
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment verification
- Updated `README.md` - Added Replit deployment section

## Architecture Changes

### Development Mode
```
Browser :5000 (Vite dev server)
    ↓ (proxies /api/*)
FastAPI :8000
```

### Production Mode
```
Browser :80
    ↓
FastAPI :5000
    ├─ /api/* → API routes
    └─ /* → Static files (built React app)
```

## Testing Performed

1. Frontend build - ✅ Success
   - Output: `dist/index.html` + `dist/assets/`
   - Size: ~274KB JavaScript, ~6KB CSS

2. Backend imports - ⏸️ Pending (requires dependency installation)
3. Deployment config - ✅ Verified
4. Path resolution - ✅ Dynamic paths work

## Deployment Process

1. **Build Phase:**
   - Installs frontend dependencies
   - Builds React app to `frontend/dist`

2. **Run Phase:**
   - Installs backend dependencies
   - Converts DATABASE_URL to asyncpg format
   - Starts FastAPI on port 5000
   - Serves both API and frontend

3. **First Request:**
   - Backend auto-creates database tables
   - Seeds demo users

## Environment Variables

All configured in `.replit`:
- `GOOGLE_CLIENT_ID` - Google OAuth
- `SMTP_*` - Email OTP configuration
- `OTP_TTL_SECONDS` - OTP expiry time
- `OTP_MAX_ATTEMPTS` - Max OTP attempts
- `SECRET_KEY` - JWT signing
- `DATABASE_URL` - Auto-provided by Replit

## Known Limitations in Replit Deployment

1. **No Vault** - Falls back to mock tokens (demo only)
2. **No Redis/Celery** - TTL revocation is synchronous
3. **No Docker** - Full stack requires Docker Compose

For production with secrets management and background workers, use Docker deployment.

## Next Steps for Production

1. Generate secure `SECRET_KEY`
2. Configure real SMTP credentials
3. Set up Google OAuth properly
4. Review and change demo passwords
5. Add rate limiting
6. Configure logging and monitoring
7. Consider Docker deployment for full features

## Files Modified

- `.replit` - Deployment configuration
- `backend/app/main.py` - Static file serving
- `frontend/vite.config.js` - Build config
- `start.sh` - Dynamic paths, auto-install
- `README.md` - Added deployment docs

## Files Created

- `DEPLOYMENT.md` - Deployment guide
- `DEPLOYMENT_CHECKLIST.md` - Verification steps
- `CHANGES.md` - This file
