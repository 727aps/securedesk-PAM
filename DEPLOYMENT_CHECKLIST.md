# Deployment Checklist

## Pre-Deployment Verification

### Files Updated
- [x] `.replit` - Deployment configuration with proper build and run commands
- [x] `backend/app/main.py` - Added static file serving for production
- [x] `frontend/vite.config.js` - Configured build output
- [x] `start.sh` - Updated for flexible path handling and dependency installation
- [x] `README.md` - Added Replit deployment instructions
- [x] `DEPLOYMENT.md` - Complete deployment guide

### Configuration Verified
- [x] Backend runs on port 5000 in production
- [x] Frontend builds to `frontend/dist`
- [x] API routes prefixed with `/api`
- [x] Static files served from built frontend
- [x] Database URL auto-converted to asyncpg format
- [x] Environment variables configured in `.replit`

## Deployment Steps

### 1. Verify Build
```bash
cd frontend && npm install && npm run build
```
Expected output: `dist/` directory with `index.html` and `assets/`

### 2. Check Backend Configuration
The backend will:
- Install dependencies from `requirements.txt`
- Auto-create database tables on startup
- Serve API at `/api/*`
- Serve frontend at all other routes

### 3. Environment Variables
Verify these are set in Replit:
- `DATABASE_URL` (auto-provided by Replit PostgreSQL)
- `GOOGLE_CLIENT_ID`
- `SMTP_*` variables (if email OTP is enabled)

### 4. Deploy
Click "Deploy" in Replit. The deployment will:
1. Run build command: `cd frontend && npm install && npm run build`
2. Run backend: `cd backend && pip install ... && uvicorn app.main:app --host 0.0.0.0 --port 5000`

### 5. Test
Once deployed:
- Visit your Replit URL
- Should see the login page
- Try logging in with demo credentials:
  - Username: `alice` / Password: `password123`
  - Username: `bob` / Password: `password123`
  - Username: `admin` / Password: `password123`

### 6. Verify Features
- [x] Login works
- [x] Google OAuth works (if configured)
- [x] User can create access request
- [x] Approver can issue OTP
- [x] OTP verification works
- [x] Request approval works
- [x] Secret checkout works
- [x] Audit log displays events

## Post-Deployment

### Database
The database will auto-initialize with:
- `users` table with 3 demo users
- `access_requests` table
- `otp_challenges` table
- `audit_log` table

### Monitoring
Check logs for:
- Database connection success
- Table creation
- Any import errors
- API request logs

## Troubleshooting

### "ModuleNotFoundError: No module named 'fastapi'"
- Deployment didn't install backend dependencies
- Check that pip install command runs in deployment
- Verify `requirements.txt` is in `backend/` directory

### Frontend shows 404
- Frontend build failed or dist/ not created
- Check build logs
- Verify `frontend/dist/index.html` exists

### Database connection error
- PostgreSQL service not running
- Check `DATABASE_URL` is set
- Verify database initialization in Replit

### API returns 404
- Routes not prefixed with `/api`
- Check `backend/app/main.py` has `prefix="/api"` on routers

## Security Checklist for Production

- [ ] Change `SECRET_KEY` to a secure random value
- [ ] Update SMTP credentials or disable if not using email OTP
- [ ] Configure proper CORS origins (not `allow_origins=["*"]`)
- [ ] Set Google OAuth redirect URLs in Google Cloud Console
- [ ] Enable HTTPS (automatic on Replit)
- [ ] Review and update demo user passwords
- [ ] Add rate limiting on auth endpoints
- [ ] Configure proper logging and monitoring

## Known Limitations

### Vault Integration
- Vault is not available in Replit deployment
- The app falls back to mock tokens for demo purposes
- For production with real secrets, deploy with Docker

### Celery/Redis
- Redis and Celery workers not available in basic Replit deployment
- TTL revocation happens synchronously instead of via background worker
- For production with auto-revocation, deploy with Docker

### Email OTP
- Requires valid SMTP credentials
- Falls back to displaying OTP in logs if email fails
- Configure SMTP environment variables for production use
