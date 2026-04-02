from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


# ─── User schemas ─────────────────────────────────────────────────────────────
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    department: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: str = "user"


class UserOut(UserBase):
    id: uuid.UUID
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Auth schemas ─────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Access request schemas ───────────────────────────────────────────────────
class AccessRequestCreate(BaseModel):
    system_name: str
    resource_path: str
    justification: str
    requested_ttl: int = 3600  # 1 hour default


class AccessRequestOut(BaseModel):
    id: uuid.UUID
    requester_id: uuid.UUID
    approver_id: Optional[uuid.UUID] = None
    system_name: str
    resource_path: str
    justification: str
    requested_ttl: int
    approved_ttl: Optional[int] = None
    status: str
    caller_verified: bool
    verification_method: Optional[str] = None
    approver_notes: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    requester_name: Optional[str] = None
    approver_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ApproveRequest(BaseModel):
    approved_ttl: int = 3600
    notes: Optional[str] = None
    verification_method: str = "otp"  # otp | push | in_person


class RejectRequest(BaseModel):
    notes: str


class VerifyOTPRequest(BaseModel):
    otp_code: str


class CheckoutResponse(BaseModel):
    request_id: uuid.UUID
    vault_token: str
    secret_path: str
    expires_at: datetime
    instructions: str


# ─── Audit schemas ────────────────────────────────────────────────────────────
class AuditLogOut(BaseModel):
    id: int
    event_time: datetime
    actor_name: Optional[str] = None
    event_type: str
    request_id: Optional[uuid.UUID] = None
    details: Optional[dict] = None

    model_config = {"from_attributes": True}


# ─── OTP Challenge ────────────────────────────────────────────────────────────
class OTPChallengeOut(BaseModel):
    expires_at: datetime
    message: str
    email_sent: bool = False


# ─── Google OAuth ──────────────────────────────────────────────────────────────
class GoogleAuthRequest(BaseModel):
    credential: str
