"""
Audit service — thin wrapper to append immutable audit events.
All privileged actions (approve, checkout, revoke) go through here.
"""
import uuid
import logging
import ipaddress
from datetime import datetime, timezone
from sqlalchemy import cast
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import INET
from app.models.request import AuditLog

logger = logging.getLogger(__name__)

# Event type constants
REQUEST_CREATED     = "REQUEST_CREATED"
REQUEST_APPROVED    = "REQUEST_APPROVED"
REQUEST_REJECTED    = "REQUEST_REJECTED"
OTP_ISSUED          = "OTP_ISSUED"
OTP_VERIFIED        = "OTP_VERIFIED"
OTP_FAILED          = "OTP_FAILED"
CALLER_VERIFIED     = "CALLER_VERIFIED"
SECRET_CHECKED_OUT  = "SECRET_CHECKED_OUT"
SECRET_REVOKED      = "SECRET_REVOKED"
SECRET_EXPIRED      = "SECRET_EXPIRED"
REQUEST_REVOKED     = "REQUEST_REVOKED"
MANUAL_REVOKE       = "MANUAL_REVOKE"


async def log_event(
    db: AsyncSession,
    event_type: str,
    actor_id: uuid.UUID | None = None,
    actor_name: str | None = None,
    request_id: uuid.UUID | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    parsed_ip = None
    if ip_address:
        parsed_ip = ipaddress.ip_address(ip_address)

    entry = AuditLog(
        event_time=datetime.now(timezone.utc),
        actor_id=actor_id,
        actor_name=actor_name,
        event_type=event_type,
        request_id=request_id,
        details=details or {},
        ip_address=cast(str(parsed_ip), INET) if parsed_ip is not None else None,
        user_agent=user_agent,
    )
    db.add(entry)
    # Caller commits via get_db() context manager
    logger.info(f"AUDIT [{event_type}] actor={actor_name} request={request_id}")
