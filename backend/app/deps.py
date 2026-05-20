import hmac
from typing import Optional

from fastapi import Header, HTTPException, Query, status

from .config import get_settings


def _validate(key: str) -> str:
    for valid in get_settings().api_keys:
        if hmac.compare_digest(valid, key):
            return key
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key"
    )


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> str:
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )
    return _validate(x_api_key)


def require_api_key_flexible(
    x_api_key: Optional[str] = Header(default=None),
    api_key: Optional[str] = Query(default=None),
) -> str:
    """Accept API key via header OR query param.

    Used for SSE endpoint because the browser EventSource API
    cannot set custom headers."""
    key = x_api_key or api_key
    if not key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key (X-API-Key header or api_key query param)",
        )
    return _validate(key)
