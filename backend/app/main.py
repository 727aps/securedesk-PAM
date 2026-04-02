from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

app.include_router(auth.router)
app.include_router(requests_router.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "securedesk-pam"}
