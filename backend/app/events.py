import asyncio
import json
from typing import AsyncIterator

import redis.asyncio as redis
import structlog

from .config import get_settings

log = structlog.get_logger(__name__)


async def subscribe_job_events() -> AsyncIterator[dict]:
    settings = get_settings()
    client = redis.from_url(settings.redis_url, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(settings.bull_events_channel)
    try:
        while True:
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=15.0
            )
            if msg is None:
                yield {"event": "ping", "data": "{}"}
                continue
            try:
                data = msg["data"]
                payload = json.loads(data) if isinstance(data, str) else data
                yield {"event": "job_update", "data": json.dumps(payload)}
            except (json.JSONDecodeError, KeyError):
                log.warning("invalid_event_message", raw=msg)
    except asyncio.CancelledError:
        raise
    finally:
        try:
            await pubsub.unsubscribe(settings.bull_events_channel)
            await pubsub.close()
        finally:
            await client.aclose()
