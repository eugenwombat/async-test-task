import pytest


@pytest.mark.asyncio
async def test_post_jobs_requires_api_key(client):
    res = await client.post("/jobs", json={"url": "https://example.com", "job_type": "extract"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_post_jobs_rejects_invalid_key(client):
    res = await client.post(
        "/jobs",
        headers={"X-API-Key": "nope"},
        json={"url": "https://example.com", "job_type": "extract"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_list_jobs_requires_api_key(client):
    res = await client.get("/jobs")
    assert res.status_code == 401
