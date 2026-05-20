from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from bullmq import Queue

from ..db import get_session
from ..deps import require_api_key
from ..models import Job
from ..queue import get_queue
from ..ratelimit import limiter
from ..schemas import JobCreate, JobCreated, JobListOut, JobOut

router = APIRouter(prefix="/jobs", tags=["jobs"])
log = structlog.get_logger(__name__)


@router.post(
    "",
    response_model=JobCreated,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_api_key)],
)
@limiter.limit("10/minute")
async def create_job(
    request: Request,
    payload: JobCreate,
    session: AsyncSession = Depends(get_session),
    queue: Queue = Depends(get_queue),
) -> JobCreated:
    job = Job(url=str(payload.url), job_type=payload.job_type, status="queued")
    session.add(job)
    await session.commit()
    await session.refresh(job)

    await queue.add(
        "process",
        {"job_id": str(job.id), "url": job.url, "job_type": job.job_type},
        {
            "attempts": 3,
            "backoff": {"type": "exponential", "delay": 2000},
            "removeOnComplete": {"count": 1000},
            "removeOnFail": {"count": 5000},
        },
    )

    log.info("job_enqueued", job_id=str(job.id), url=job.url, job_type=job.job_type)
    return JobCreated(job_id=job.id, status="queued")


@router.get("/{job_id}", response_model=JobOut, dependencies=[Depends(require_api_key)])
async def get_job(
    job_id: UUID, session: AsyncSession = Depends(get_session)
) -> JobOut:
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobOut.model_validate(job)


@router.get("", response_model=JobListOut, dependencies=[Depends(require_api_key)])
async def list_jobs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> JobListOut:
    stmt = (
        select(Job).order_by(Job.created_at.desc()).offset(offset).limit(limit)
    )
    result = await session.execute(stmt)
    jobs = result.scalars().all()
    return JobListOut(jobs=[JobOut.model_validate(j) for j in jobs])
