import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_current_user
from app.models.user import User
from app.schemas.schemas import LoginRequest, TokenResponse, UserOut, UserCreate, GoogleAuthRequest
from app.core.security import hash_password
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Demo endpoint — in production gate this behind admin auth."""
    existing = await db.execute(
        select(User).where(
            (User.username == payload.username) | (User.email == payload.email)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username or email already taken")

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
    )
    db.add(user)
    await db.flush()
    return UserOut.model_validate(user)


@router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Verify a Google ID token issued by the frontend SDK and return a JWT."""
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        id_info = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception as e:
        logger.warning("Google token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential",
        )

    email: str = id_info.get("email", "").lower()
    full_name: str = id_info.get("name", email)

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    # Look up by email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        # Create new user — derive username from email prefix
        base_username = email.split("@")[0]
        # Ensure unique username
        username = base_username
        suffix = 1
        while True:
            clash = await db.execute(select(User).where(User.username == username))
            if clash.scalar_one_or_none() is None:
                break
            username = f"{base_username}{suffix}"
            suffix += 1

        user = User(
            username=username,
            email=email,
            full_name=full_name,
            hashed_password=None,
            role="user",
            auth_provider="google",
        )
        db.add(user)
        await db.flush()
        logger.info("Created new Google-authenticated user: %s", email)
    elif not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    else:
        logger.info("Google login for existing user: %s", email)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))
