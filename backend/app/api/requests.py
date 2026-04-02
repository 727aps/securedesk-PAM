"""
Access Requests API — the core PAM flow:

User:     POST /requests                  → create request
Approver: GET  /requests                  → list pending requests
Approver: POST /requests/{id}/otp         → issue OTP for caller verification
Approver: POST /requests/{id}/verify-otp  → verify OTP (marks caller_verified)
Approver: POST /requests/{id}/approve     → approve (creates Vault JIT token)
Approver: POST /requests/{id}/reject      → reject
User:     POST /requests/{id}/checkout    → get scoped Vault token
User:     POST /requests/{id}/revoke      → early manual revoke
Admin:    GET  /requests/audit            → full audit log
"""
import uuid
import secrets
import string
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.request import AccessRequest, OTPChallenge, AuditLog
from app.schemas.schemas import (
    AccessRequestCreate, AccessRequestOut, ApproveRequest,
    RejectRequest, VerifyOTPRequest, CheckoutResponse,
    OTPChallengeOut, AuditLogOut,
)
from app.services import vault_service, audit_service
from app.core.config import get_settings

router = APIRouter(prefix="/requests", tags=["requests"])
settings = get_settings()


def _enrich(req: AccessRequest) -> AccessRequestOut:
    out = AccessRequestOut.model_validate(req)
    out.requester_name = req.requester.full_name if req.requester else None
    out.approver_name = req.approver.full_name if req.approver else None
    return out


# ─── User: create request ─────────────────────────────────────────────────────
@router.post("", response_model=AccessRequestOut, status_code=201)
async def create_request(
    payload: AccessRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Seed the secret in Vault so the demo works out of the box
    vault_service.ensure_secret_exists(payload.resource_path)

    req = AccessRequest(
        requester_id=current_user.id,
        system_name=payload.system_name,
        resource_path=payload.resource_path,
        justification=payload.justification,
        requested_ttl=min(payload.requested_ttl, 86400),  # cap at 24h
        status="pending",
    )
    db.add(req)
    await db.flush()

    await audit_service.log_event(
        db,
        event_type=audit_service.REQUEST_CREATED,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        request_id=req.id,
        details={"system": payload.system_name, "path": payload.resource_path},
        ip_address=request.client.host if request.client else None,
    )

    await db.refresh(req, ["requester", "approver"])
    return _enrich(req)


# ─── List requests ─────────────────────────────────────────────────────────────
@router.get("", response_model=list[AccessRequestOut])
async def list_requests(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(AccessRequest)
    if current_user.role == "user":
        q = q.where(AccessRequest.requester_id == current_user.id)
    if status_filter:
        q = q.where(AccessRequest.status == status_filter)
    q = q.order_by(desc(AccessRequest.created_at))

    result = await db.execute(q)
    requests = result.scalars().all()
    # Eager-load relationships
    for r in requests:
        await db.refresh(r, ["requester", "approver"])
    return [_enrich(r) for r in requests]


# ─── Get single request ────────────────────────────────────────────────────────
@router.get("/{request_id}", response_model=AccessRequestOut)
async def get_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Request not found")
    if current_user.role == "user" and req.requester_id != current_user.id:
        raise HTTPException(403, "Not your request")
    await db.refresh(req, ["requester", "approver"])
    return _enrich(req)


# ─── Approver: issue OTP for caller verification ──────────────────────────────
@router.post("/{request_id}/otp", response_model=OTPChallengeOut)
async def issue_otp(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
):
    result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req or req.status != "pending":
        raise HTTPException(400, "Request not found or not pending")

    # Generate a 6-digit OTP
    otp_code = "".join(secrets.choice(string.digits) for _ in range(6))
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.OTP_TTL_SECONDS)

    challenge = OTPChallenge(
        request_id=request_id,
        otp_code=otp_code,
        expires_at=expires_at,
    )
    db.add(challenge)

    await audit_service.log_event(
        db,
        event_type=audit_service.OTP_ISSUED,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        request_id=request_id,
        details={"method": "otp"},
    )

    return OTPChallengeOut(
        otp_code=otp_code,
        expires_at=expires_at,
        message="Read this code to the caller over the helpdesk call. Do NOT share via SMS or email.",
    )


# ─── Approver: verify OTP (caller confirmed identity) ────────────────────────
@router.post("/{request_id}/verify-otp")
async def verify_otp(
    request_id: uuid.UUID,
    payload: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(OTPChallenge).where(
            OTPChallenge.request_id == request_id,
            OTPChallenge.used == False,
            OTPChallenge.expires_at > now,
        ).order_by(desc(OTPChallenge.issued_at))
    )
    challenge = result.scalar_one_or_none()

    if not challenge or challenge.otp_code != payload.otp_code:
        await audit_service.log_event(
            db,
            event_type=audit_service.OTP_FAILED,
            actor_id=current_user.id,
            actor_name=current_user.full_name,
            request_id=request_id,
        )
        raise HTTPException(400, "Invalid or expired OTP code")

    challenge.used = True

    req_result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = req_result.scalar_one_or_none()
    if req:
        req.caller_verified = True
        req.verification_method = "otp"

    await audit_service.log_event(
        db,
        event_type=audit_service.CALLER_VERIFIED,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        request_id=request_id,
        details={"method": "otp"},
    )

    return {"verified": True, "message": "Caller identity confirmed via OTP"}


# ─── Approver: approve request ────────────────────────────────────────────────
@router.post("/{request_id}/approve", response_model=AccessRequestOut)
async def approve_request(
    request_id: uuid.UUID,
    payload: ApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
):
    result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req or req.status != "pending":
        raise HTTPException(400, "Request not found or not pending")

    now = datetime.now(timezone.utc)
    req.status = "approved"
    req.approver_id = current_user.id
    req.approved_at = now
    req.approved_ttl = payload.approved_ttl
    req.approver_notes = payload.notes
    if not req.caller_verified:
        req.verification_method = payload.verification_method

    await audit_service.log_event(
        db,
        event_type=audit_service.REQUEST_APPROVED,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        request_id=request_id,
        details={"ttl": payload.approved_ttl, "notes": payload.notes},
    )

    await db.refresh(req, ["requester", "approver"])
    return _enrich(req)


# ─── Approver: reject request ─────────────────────────────────────────────────
@router.post("/{request_id}/reject", response_model=AccessRequestOut)
async def reject_request(
    request_id: uuid.UUID,
    payload: RejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("approver", "admin")),
):
    result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req or req.status != "pending":
        raise HTTPException(400, "Request not found or not pending")

    req.status = "rejected"
    req.approver_id = current_user.id
    req.approver_notes = payload.notes

    await audit_service.log_event(
        db,
        event_type=audit_service.REQUEST_REJECTED,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        request_id=request_id,
        details={"notes": payload.notes},
    )

    await db.refresh(req, ["requester", "approver"])
    return _enrich(req)


# ─── User: checkout (get Vault token) ────────────────────────────────────────
@router.post("/{request_id}/checkout", response_model=CheckoutResponse)
async def checkout_secret(
    request_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.requester_id != current_user.id:
        raise HTTPException(403, "Not your request")
    if req.status != "approved":
        raise HTTPException(400, f"Request is {req.status}, must be approved to checkout")

    # Create JIT Vault token
    ttl = req.approved_ttl or req.requested_ttl
    vault_result = vault_service.create_limited_token(ttl, req.resource_path)

    now = datetime.now(timezone.utc)
    req.status = "active"
    req.vault_token = vault_result["token"]
    req.activated_at = now
    req.expires_at = now + timedelta(seconds=ttl)

    await audit_service.log_event(
        db,
        event_type=audit_service.SECRET_CHECKED_OUT,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        request_id=request_id,
        details={
            "system": req.system_name,
            "path": req.resource_path,
            "ttl": ttl,
            "expires_at": req.expires_at.isoformat(),
        },
        ip_address=request.client.host if request.client else None,
    )

    return CheckoutResponse(
        request_id=request_id,
        vault_token=vault_result["token"],
        secret_path=req.resource_path,
        expires_at=req.expires_at,
        instructions=(
            f"Use this token with the Vault API to read {req.resource_path}. "
            f"It expires in {ttl} seconds. Never share this token."
        ),
    )


# ─── User / Approver: manual revoke ──────────────────────────────────────────
@router.post("/{request_id}/revoke")
async def revoke_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(AccessRequest).where(AccessRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req or req.status != "active":
        raise HTTPException(400, "Request not found or not active")

    # Only the requester, their approver, or an admin can revoke
    if (
        req.requester_id != current_user.id
        and current_user.role not in ("approver", "admin")
    ):
        raise HTTPException(403, "Not authorized to revoke")

    token = req.vault_token
    req.status = "revoked"
    req.revoked_at = datetime.now(timezone.utc)
    req.vault_token = None

    await audit_service.log_event(
        db,
        event_type=audit_service.SECRET_REVOKED,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        request_id=request_id,
        details={"revoked_by": current_user.role},
    )

    # Dispatch Celery task to actually revoke the Vault token
    if token:
        from app.celery_app import revoke_single_token
        revoke_single_token.delay(str(request_id), token)

    return {"revoked": True, "request_id": str(request_id)}


# ─── Admin: audit log ─────────────────────────────────────────────────────────
@router.get("/admin/audit", response_model=list[AuditLogOut])
async def get_audit_log(
    limit: int = 100,
    request_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "approver")),
):
    q = select(AuditLog).order_by(desc(AuditLog.event_time)).limit(limit)
    if request_id:
        q = q.where(AuditLog.request_id == request_id)
    result = await db.execute(q)
    return result.scalars().all()
