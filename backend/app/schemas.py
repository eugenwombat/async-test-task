from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

JobStatus = Literal["queued", "processing", "completed", "failed"]
JobType = Literal["extract", "screenshot"]


class JobCreate(BaseModel):
    url: HttpUrl
    job_type: JobType = "extract"


class JobCreated(BaseModel):
    job_id: UUID
    status: JobStatus = "queued"


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: UUID = Field(validation_alias="id")
    status: JobStatus
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    url: str
    job_type: str


class JobListOut(BaseModel):
    jobs: list[JobOut]
