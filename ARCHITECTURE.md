# Architecture notes

A short companion to the README for reviewers who want the reasoning behind specific decisions.

## Component split

| Service   | Language | Role                                                        |
|-----------|----------|-------------------------------------------------------------|
| backend   | Python   | FastAPI REST + SSE; producer for BullMQ                     |
| worker    | Node.js  | BullMQ Worker; writes Postgres; publishes Redis events      |
| postgres  | —        | Durable job state (single source of truth)                  |
| redis     | —        | BullMQ queue + pub/sub channel `job-events`                 |
| frontend  | TS/React | Vite SPA served by NGINX, reverse-proxies `/api` & `/events`|

Two language runtimes deliberately mirror the production stack from the job description:
> Backend: Python (FastAPI), Node.js, BullMQ, Redis, Postgres.
> Worker fleet: Playwright (Node.js) consuming BullMQ.

## Data flow

### POST /jobs
```
React → fetch /jobs
       FastAPI: Pydantic validate → INSERT jobs(status=queued) → Queue.add('process',…)
       ← 202 {job_id, status:'queued'}
```

### Worker tick
```
Worker BLPOP → UPDATE jobs SET status='processing'
            → PUBLISH job-events {status:'processing',…}
            → sleep 5–15s, maybe throw
            → UPDATE jobs SET status='completed'|'failed', result|error
            → PUBLISH job-events {…}
```

### SSE fan-out
```
React EventSource('/events/jobs?api_key=…')
   → FastAPI subscribes redis.asyncio.pubsub to 'job-events'
   → sse_starlette streams each message as `event: job_update\n data: {…}\n\n`
```

## Why these choices

- **Single source of truth in Postgres.** If Redis is lost, queued/processing rows are still in Postgres and can be re-enqueued by a one-shot repair script. The reverse (Redis as source of truth) is brittle.
- **BullMQ-Python on the producer side.** Lets FastAPI speak the same Redis-key schema as the Node.js worker. We avoid building a bespoke queue protocol, get retries + delayed jobs for free.
- **SSE over WebSocket.** Status updates are unidirectional. SSE has built-in reconnect, traverses HTTP infrastructure cleanly, and is trivial to test with `curl -N`. WebSocket adds complexity we don't need.
- **Two-pool ownership.** Backend's pool writes initial `queued` rows; worker's pool writes all transitions. Splitting writes by lifecycle stage prevents accidental cross-talk.
- **Per-key rate limiting.** Limits abusive callers without affecting dashboard reads (limit is only on `POST /jobs`).
- **Nginx in front of Vite build.** Production-style: static dist served with `try_files` for SPA fallback; `/api` and `/events` reverse-proxied; SSE-specific block disables proxy buffering and bumps timeouts.

## Trade-offs accepted

- API-key auth in URL query for SSE. Necessary because `EventSource` cannot set headers. Logged URLs may leak the key — fine for an internal demo, not for prod. Real fix: short-lived signed token issued by `POST /auth/sse-token`.
- In-process rate limiter (slowapi default). Does not aggregate across replicas. README §8 explains the upgrade path.
- Worker does not yet implement idempotency on its writes. With `attempts: 3` plus exp backoff there is a small window where a retry could clobber an in-flight `processing` row. Mitigation noted in README §7.
- No alembic autogenerate enabled; the single migration is hand-written. Sufficient for one table; revisit when the schema grows.

## What is intentionally **not** here

- Real web scraping (Playwright, anti-bot, proxy rotation) — the PDF asks for simulated processing.
- Multi-tenant accounts, billing, Stripe — those are Milestone 4 of the hiring project, not the evaluation.
- Kubernetes manifests — task boundaries: no host-level network changes; docker-compose is the deliverable.
- Production secrets manager wiring — env-based config with `.env` is sufficient for evaluation.
