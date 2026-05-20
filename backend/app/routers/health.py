from fastapi import APIRouter
import redis.asyncio as redis
import structlog
from sqlalchemy import text

from ..config import get_settings
from ..db import engine

router = APIRouter()
log = structlog.get_logger(__name__)


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    db_status = "down"
    redis_status = "down"

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "up"
    except Exception as exc:
        log.warning("health_db_failed", error=str(exc))

    client = redis.from_url(settings.redis_url)
    try:
        await client.ping()
        redis_status = "up"
    except Exception as exc:
        log.warning("health_redis_failed", error=str(exc))
    finally:
        await client.aclose()

    overall = "ok" if db_status == "up" and redis_status == "up" else "degraded"
    return {"status": overall, "db": db_status, "redis": redis_status}
