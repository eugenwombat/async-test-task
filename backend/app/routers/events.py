from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from ..deps import require_api_key_flexible
from ..events import subscribe_job_events

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/jobs", dependencies=[Depends(require_api_key_flexible)])
async def stream_job_events() -> EventSourceResponse:
    return EventSourceResponse(subscribe_job_events())
