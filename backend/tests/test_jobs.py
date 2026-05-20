import pytest


@pytest.mark.asyncio
async def test_post_jobs_enqueues_and_returns_queued(client, api_key, enqueued, job_store):
    res = await client.post(
        "/jobs",
        headers={"X-API-Key": api_key},
        json={"url": "https://example.com", "job_type": "extract"},
    )
    assert res.status_code == 202
    body = res.json()
    assert body["status"] == "queued"
    assert "job_id" in body
    assert len(enqueued) == 1
    assert enqueued[0]["name"] == "process"
    assert enqueued[0]["data"]["url"] == "https://example.com/"
    assert enqueued[0]["data"]["job_type"] == "extract"
    assert len(job_store) == 1


@pytest.mark.asyncio
async def test_get_job_returns_required_shape(client, api_key):
    create = await client.post(
        "/jobs",
        headers={"X-API-Key": api_key},
        json={"url": "https://example.com", "job_type": "extract"},
    )
    job_id = create.json()["job_id"]
    res = await client.get(f"/jobs/{job_id}", headers={"X-API-Key": api_key})
    assert res.status_code == 200
    body = res.json()
    for field in ["job_id", "status", "result", "error", "created_at", "updated_at"]:
        assert field in body, f"missing {field}"
    assert body["status"] == "queued"


@pytest.mark.asyncio
async def test_post_invalid_url_returns_422(client, api_key):
    res = await client.post(
        "/jobs",
        headers={"X-API-Key": api_key},
        json={"url": "not-a-url", "job_type": "extract"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_post_invalid_job_type_returns_422(client, api_key):
    res = await client.post(
        "/jobs",
        headers={"X-API-Key": api_key},
        json={"url": "https://example.com", "job_type": "nope"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_list_jobs_returns_array(client, api_key):
    for i in range(3):
        await client.post(
            "/jobs",
            headers={"X-API-Key": api_key},
            json={"url": f"https://example.com/{i}", "job_type": "extract"},
        )
    res = await client.get("/jobs", headers={"X-API-Key": api_key})
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["jobs"], list)
    assert len(body["jobs"]) == 3
