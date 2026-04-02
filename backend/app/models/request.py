import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Boolean, Integer, Text, DateTime, ForeignKey, BigInteger
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approver_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    system_name: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_path: Mapped[str] = mapped_column(String(500), nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)

    requested_ttl: Mapped[int] = mapped_column(Integer, default=3600)
    approved_ttl: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    vault_token: Mapped[str | None] = mapped_column(Text)
    vault_lease_id: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    caller_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_method: Mapped[str | None] = mapped_column(String(50))
    approver_notes: Mapped[str | None] = mapped_column(Text)

    requester: Mapped["User"] = relationship(
        "User", back_populates="requests_made", foreign_keys=[requester_id]
    )
    approver: Mapped["User | None"] = relationship(
        "User", back_populates="requests_approved", foreign_keys=[approver_id]
    )
    otp_challenges: Mapped[list["OTPChallenge"]] = relationship("OTPChallenge", back_populates="request")


class OTPChallenge(Base):
    __tablename__ = "otp_challenges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("access_requests.id"), nullable=False)
    otp_code: Mapped[str] = mapped_column(String(8), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)

    request: Mapped["AccessRequest"] = relationship("AccessRequest", back_populates="otp_challenges")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    actor_name: Mapped[str | None] = mapped_column(String(100))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("access_requests.id"))
    details: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(Text)
