# Deployment Guide

## Replit Deployment

The project is configured for automatic deployment on Replit.

### Configuration

The `.replit` file contains the deployment configuration:

- **Build step**: Installs frontend dependencies and builds the React app
- **Run step**: Installs backend dependencies and starts the FastAPI server on port 5000
- **Frontend serving**: The built frontend is served by FastAPI as static files

### Environment Variables

The following environment variables are pre-configured in `.replit`:

```
GOOGLE_CLIENT_ID=431643847341-ljrd2viuoqh03pmebdn4c3m2l8jooj7m.apps.googleusercontent.com
FRONTEND_URL=http://localhost
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=s72799107@gmail.com
SMTP_PASSWORD=avgqrlpvbelhjiyc
SMTP_USE_TLS=true
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
```

The `DATABASE_URL` is automatically provided by Replit's PostgreSQL service.

### Deployment Process

1. Push your code to the Replit project
2. Click the "Deploy" button in the Replit interface
3. The build process will:
   - Run `cd frontend && npm install && npm run build`
   - Install backend dependencies
   - Start the server with `uvicorn app.main:app --host 0.0.0.0 --port 5000`

The application will be available at your Replit deployment URL.

### Architecture in Production

```
Browser → Replit Domain :80
            ↓
      FastAPI Server :5000
            ├─ /api/* → Backend API routes
            └─ /* → Frontend static files (built React app)
```

The FastAPI server serves both:
- API endpoints at `/api/*`
- Built frontend files at all other routes

### Database

The Replit PostgreSQL database is automatically configured. The backend will:
1. Auto-convert the `DATABASE_URL` to asyncpg format
2. Create all required tables on startup
3. Seed demo users (alice, bob, admin) if they don't exist

### Development vs Production

**Development Mode** (via `bash start.sh`):
- Backend runs on port 8000
- Frontend runs on port 5000 with Vite dev server
- Frontend proxies API requests to backend

**Production Mode** (deployment):
- Backend runs on port 5000
- Frontend is pre-built and served as static files
- All requests go through FastAPI server

## Local Development

To run the project locally:

```bash
# Install dependencies
cd backend
pip3 install --break-system-packages -r requirements.txt

cd ../frontend
npm install

# Start development servers
cd ..
bash start.sh
```

This starts:
- Backend on http://localhost:8000
- Frontend on http://localhost:5000

## Docker Deployment

For full Docker deployment with Vault and Redis:

```bash
docker compose up --build
```

This starts 8 containers:
- Nginx (port 80)
- FastAPI backend
- React frontend (Vite dev server)
- PostgreSQL
- HashiCorp Vault (port 8200)
- Redis
- Celery worker
- Celery beat

## Security Notes

For production deployment:

1. Change the `SECRET_KEY` environment variable
2. Update SMTP credentials or disable email OTP
3. Configure proper CORS origins in `backend/app/main.py`
4. Use environment-specific Google OAuth client IDs
5. Enable HTTPS (Replit provides this automatically)

## Troubleshooting

### Build fails with "command not found"
Make sure both Node.js and Python modules are enabled in `.replit`

### Database connection error
Check that `DATABASE_URL` is set correctly and the PostgreSQL service is running

### Frontend shows blank page
Verify that:
1. The frontend build completed successfully
2. The `frontend/dist` directory exists
3. The backend is serving static files correctly

### Google OAuth not working
Ensure the `GOOGLE_CLIENT_ID` matches your Google Cloud Console configuration
