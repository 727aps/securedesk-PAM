import asyncio
import logging
from datetime import datetime, timezone
from celery import Celery

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery(
    "securedesk",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "revoke-expired-every-minute": {
            "task": "app.celery_app.revoke_expired_tokens",
            "schedule": 60.0,
        },
    },
)


def _run_async(coro):
    """Safe async runner for Celery"""
    return asyncio.run(coro)


@celery_app.task(name="app.celery_app.revoke_expired_tokens", bind=True, max_retries=3)
def revoke_expired_tokens(self):
    async def _do():
        from sqlalchemy import select, and_
        from app.core.database import AsyncSessionLocal
        from app.models.request import AccessRequest
        from app.services import vault_service, audit_service

        async with AsyncSessionLocal() as db:
            try:
                now = datetime.now(timezone.utc)

                result = await db.execute(
                    select(AccessRequest).where(
                        and_(
                            AccessRequest.status == "active",
                            AccessRequest.expires_at <= now,
                        )
                    )
                )

                expired = result.scalars().all()
                count = 0

                for req in expired:
                    try:
                        if req.vault_token:
                            await vault_service.revoke_token(req.vault_token)

                        req.status = "expired"
                        req.revoked_at = now
                        req.vault_token = None

                        await audit_service.log_event(
                            db,
                            event_type=audit_service.SECRET_EXPIRED,
                            request_id=req.id,
                            details={
                                "system": req.system_name,
                                "path": req.resource_path,
                            },
                        )

                        count += 1

                    except Exception as e:
                        logger.error(f"Failed to revoke token for {req.id}: {e}")

                await db.commit()

                if count:
                    logger.info(f"Revoked {count} expired sessions")

            except Exception as e:
                await db.rollback()
                logger.error(f"Celery task failed: {e}")
                raise

    _run_async(_do())


@celery_app.task(name="app.celery_app.revoke_single_token", bind=True, max_retries=3)
def revoke_single_token(self, request_id: str, vault_token: str):
    async def _do():
        from sqlalchemy import select
        from app.core.database import AsyncSessionLocal
        from app.models.request import AccessRequest
        from app.services import vault_service, audit_service
        import uuid

        async with AsyncSessionLocal() as db:
            try:
                await vault_service.revoke_token(vault_token)

                result = await db.execute(
                    select(AccessRequest).where(
                        AccessRequest.id == uuid.UUID(request_id)
                    )
                )

                req = result.scalar_one_or_none()

                if req:
                    req.status = "revoked"
                    req.revoked_at = datetime.now(timezone.utc)
                    req.vault_token = None

                    await audit_service.log_event(
                        db,
                        event_type=audit_service.MANUAL_REVOKE,
                        request_id=req.id,
                        details={"system": req.system_name},
                    )

                    await db.commit()

            except Exception as e:
                await db.rollback()
                logger.error(f"Manual revoke failed: {e}")
                raise

    _run_async(_do())