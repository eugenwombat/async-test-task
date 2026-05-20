from typing import Optional
from urllib.parse import urlparse

from bullmq import Queue

from .config import get_settings

_queue: Optional[Queue] = None


def _redis_opts() -> dict:
    parsed = urlparse(get_settings().redis_url)
    return {
        "host": parsed.hostname or "redis",
        "port": parsed.port or 6379,
        "db": int(parsed.path.lstrip("/") or "0"),
    }


def get_queue() -> Queue:
    global _queue
    if _queue is None:
        settings = get_settings()
        _queue = Queue(settings.bull_queue_name, {"connection": _redis_opts()})
    return _queue


async def close_queue() -> None:
    global _queue
    if _queue is not None:
        await _queue.close()
        _queue = None
