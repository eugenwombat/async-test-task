from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "async-jobs-backend"
    log_level: str = "INFO"

    database_url: str = Field(
        default="postgresql+asyncpg://jobs:jobs@postgres:5432/jobs"
    )
    redis_url: str = Field(default="redis://redis:6379/0")
    bull_queue_name: str = Field(default="jobs")
    bull_events_channel: str = Field(default="job-events")

    api_keys_csv: str = Field(default="dev-key-1", alias="API_KEYS")
    cors_origins_csv: str = Field(
        default="http://localhost:5173,http://localhost", alias="CORS_ORIGINS"
    )

    rate_limit_post_jobs: str = Field(default="10/minute")

    @property
    def api_keys(self) -> List[str]:
        return [k.strip() for k in self.api_keys_csv.split(",") if k.strip()]

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins_csv.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
