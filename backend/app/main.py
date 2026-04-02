import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from app.core.database import engine, Base
# Import models so SQLAlchemy registers them with Base.metadata before create_all
from app.models import user, request  # noqa: F401
from app.api import auth, requests as requests_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (idempotent — won't re-create if already exist)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="SecureDesk PAM API",
    description="Just-in-time privileged access control — CyberArk-style helpdesk PAM prototype",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router, prefix="/api")
app.include_router(requests_router.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "securedesk-pam"}


# Serve static files in production (if frontend/dist exists)
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all non-API routes"""
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        # Always return index.html for client-side routing
        return FileResponse(frontend_dist / "index.html")
