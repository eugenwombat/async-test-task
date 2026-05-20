"""Test fixtures.

We avoid hitting Postgres/Redis at unit-test time: instead the FastAPI
dependencies for DB session and BullMQ queue are overridden with in-memory
fakes. This keeps unit tests fast and deterministic.

End-to-end validation against the real stack is documented in the README
under §5 (manual checklist).
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("API_KEYS", "test-key-1,test-key-2")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x/x")
os.environ.setdefault("REDIS_URL", "redis://x:6379/0")

from app.config import get_settings  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import create_app  # noqa: E402
from app.queue import get_queue  # noqa: E402


class FakeSession:
    def __init__(self, store: Dict[uuid.UUID, Any]):
        self._store = store
        self._pending: List[Any] = []

    def add(self, obj: Any) -> None:
        self._pending.append(obj)

    async def commit(self) -> None:
        for obj in self._pending:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
            now = datetime.now(timezone.utc)
            obj.created_at = now
            obj.updated_at = now
            self._store[obj.id] = obj
        self._pending.clear()

    async def refresh(self, obj: Any) -> None:
        pass

    async def execute(self, stmt):
        from app.models import Job

        class _Result:
            def __init__(self, rows):
                self._rows = rows

            def scalar_one_or_none(self):
                return self._rows[0] if self._rows else None

            def scalars(self):
                return self

            def all(self):
                return self._rows

        compiled = str(stmt)
        rows = list(self._store.values())
        rows.sort(key=lambda j: j.created_at, reverse=True)
        if "WHERE jobs.id" in compiled:
            wanted = None
            for v in stmt.compile().params.values():
                if isinstance(v, (uuid.UUID, str)):
                    try:
                        wanted = v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))
                        break
                    except Exception:
                        pass
            rows = [j for j in rows if wanted is not None and j.id == wanted]
        return _Result(rows)


@pytest.fixture
def job_store() -> Dict[uuid.UUID, Any]:
    return {}


@pytest.fixture
def enqueued() -> List[Dict[str, Any]]:
    return []


class FakeQueue:
    def __init__(self, log: List[Dict[str, Any]]):
        self._log = log

    async def add(self, name: str, data: dict, opts: dict | None = None) -> dict:
        self._log.append({"name": name, "data": data, "opts": opts or {}})
        return {"id": str(uuid.uuid4())}

    async def close(self) -> None:
        pass


@pytest_asyncio.fixture
async def client(job_store, enqueued) -> AsyncClient:
    app = create_app()

    async def _override_session():
        yield FakeSession(job_store)

    def _override_queue():
        return FakeQueue(enqueued)

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_queue] = _override_queue

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def api_key() -> str:
    return get_settings().api_keys[0]
