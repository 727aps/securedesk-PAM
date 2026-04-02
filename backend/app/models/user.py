import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Boolean, Integer, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, INET
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    auth_provider: Mapped[str] = mapped_column(String(20), nullable=False, default="local")
    department: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    requests_made: Mapped[list["AccessRequest"]] = relationship(
        "AccessRequest", back_populates="requester", foreign_keys="AccessRequest.requester_id"
    )
    requests_approved: Mapped[list["AccessRequest"]] = relationship(
        "AccessRequest", back_populates="approver", foreign_keys="AccessRequest.approver_id"
    )
