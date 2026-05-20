# Async Job Processing Platform

A small production-style async job processing platform built for the **Scraper Technical Evaluation Task**.
It mirrors the production stack of the hiring project: **FastAPI + BullMQ + Redis + Postgres + React/Vite**, fully containerised with **Docker Compose**.

> Stack at a glance — `FastAPI (Python)` enqueues jobs into `BullMQ (Redis)`. A `Node.js worker` consumes them, persists state to `Postgres`, and publishes events to `Redis pub/sub`. `FastAPI` re-streams those events to the `React/Vite` dashboard via **SSE**.

---

## 1. Setup

```bash
git clone <this-repo>
cd async-test
cp .env.example .env          # adjust API_KEYS, POSTGRES_PASSWORD, etc.
docker compose up --build
```

After all containers report healthy:

- Dashboard: <http://localhost:5173>
- API:       <http://localhost:8000>
- Swagger:   <http://localhost:8000/docs>
- Health:    <http://localhost:8000/health>

**Requirements:** Docker 24+, Docker Compose v2. No host-side Node/Python needed.

For native dev:

```bash
# backend
cd backend && pip install -e .[dev] && uvicorn app.main:app --reload
# worker
cd worker && npm install && npm start
# frontend
cd frontend && npm install && npm run dev
```

## 2. Architecture overview

```
┌────────────────┐    fetch + SSE     ┌──────────────────────┐
│  React/Vite    │ ─────────────────▶ │  FastAPI (uvicorn)   │
│  + Tailwind    │ ◀────EventSource── │  /jobs, /events      │
└────────────────┘                    └──────────┬───────────┘
                                                  │ bullmq.Queue.add
                                                  ▼
                                       ┌──────────────────────┐
                                       │  Redis (BullMQ +     │
                                       │  pub/sub channel)    │
                                       └────┬───────────┬─────┘
                                            │ consume   │ publish
                                            ▼           │
                                  ┌──────────────────┐  │
                                  │  Node.js Worker  │──┘
                                  │  (BullMQ)        │
                                  └────────┬─────────┘
                                           │ UPDATE jobs
                                           ▼
                                  ┌──────────────────┐
                                  │  Postgres        │  ← single source of truth
                                  └──────────────────┘
```

**Design choices**

- **Postgres = source of truth.** Worker writes job state directly to Postgres so the API can always answer `GET /jobs/{id}` even if Redis is wiped. BullMQ keeps only the queue, not the durable state.
- **SSE (not WebSocket).** Job-status updates are server-push only — SSE is simpler, auto-reconnects in the browser, and works through reverse proxies without sticky sessions.
- **Single Redis instance** carries both the BullMQ queue (BLPOP-based) and a pub/sub channel `job-events`. Worker publishes; FastAPI subscribes and fans out to SSE listeners.
- **Async everywhere on the backend** (asyncpg, redis.asyncio, sse-starlette) — keeps the API non-blocking under load and lets the SSE generator yield concurrently with REST traffic.

## 3. API usage

```bash
API=http://localhost:8000
KEY=dev-key-1

# Health
curl -s $API/health
# → {"status":"ok","db":"up","redis":"up"}

# Create job
curl -s -X POST $API/jobs \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","job_type":"extract"}'
# → 202 {"job_id":"...","status":"queued"}

# Get one
curl -s $API/jobs/<job_id> -H "X-API-Key: $KEY"

# List recent
curl -s "$API/jobs?limit=50" -H "X-API-Key: $KEY"

# Stream live updates (Ctrl-C to stop)
curl -N "$API/events/jobs?api_key=$KEY"
```

## 4. How the async job flow works

1. `POST /jobs` — FastAPI validates `url` + `job_type` via Pydantic.
2. Backend inserts a `jobs` row with `status='queued'` (Postgres).
3. Backend pushes a BullMQ job (`process`) into Redis with `attempts=3, exp backoff`.
4. Node.js worker `BLPOP`s the job, sets `status='processing'`, publishes `{job_id, status, updated_at}` to Redis channel `job-events`.
5. Worker sleeps 5–15 s (random), then with ~10 % probability throws → BullMQ logs failure, worker sets `status='failed'`. Otherwise sets `status='completed'` with a fake result blob.
6. FastAPI `/events/jobs` is subscribed to the `job-events` channel and streams each update as an SSE frame.
7. React dashboard's `useJobEvents` hook listens via `EventSource` and merges incoming updates into local state.

Failed jobs auto-retry up to 3 times with exponential backoff (2 s, 4 s, 8 s) before BullMQ marks the queue entry failed.

## 5. Tests & manual validation

```bash
# Backend unit tests (FastAPI routes + auth + validation)
cd backend && pip install -e .[dev] && pytest -q

# Worker unit tests (processor state machine)
cd worker && npm install && npm test

# Frontend unit tests (components)
cd frontend && npm install && npm test
```

Manual end-to-end checklist (after `docker compose up`):

- [ ] `GET /health` returns `{"status":"ok","db":"up","redis":"up"}`
- [ ] `POST /jobs` without `X-API-Key` → 401
- [ ] `POST /jobs` with wrong key → 401
- [ ] `POST /jobs` with invalid url → 422
- [ ] `POST /jobs` with `job_type: "nope"` → 422
- [ ] Spam 11 `POST /jobs` in a minute → 11th returns 429
- [ ] Open dashboard, submit job → status transitions queued → processing → completed/failed without refresh
- [ ] Stop worker container, submit a job → stays `queued`; restart worker → it picks up

## 6. Security notes

- **API-key auth**: `X-API-Key` header (constant-time compare via `hmac.compare_digest`). Keys are CSV-loaded from `API_KEYS` env. The SSE endpoint also accepts `?api_key=…` because browser `EventSource` cannot set headers — production should switch this to a short-lived signed token.
- **Rate limit**: SlowAPI, `10/minute` per key on `POST /jobs`. In-process limiter — for multi-replica deploys swap to `redis-cell` or the SlowAPI Redis backend (see §8).
- **CORS**: explicit allow-list from `CORS_ORIGINS` env; methods limited to `GET, POST, OPTIONS`; only `X-API-Key` and `Content-Type` headers allowed.
- **Validation**: `HttpUrl` + `Literal["extract","screenshot"]` Pydantic types reject malformed input before any DB write.
- **Secrets**: nothing hard-coded; everything via env. `.env.example` ships only placeholder values; `.env` is `.gitignore`-d.
- **Logging**: `structlog` JSON output with a `request_id` per request, propagated in response header `x-request-id` for log correlation.

## 7. Known limitations

- Single-tenant authentication (shared API keys) — no per-user accounts, JWT, or OAuth.
- Rate limit is **in-process** (slowapi default backend) — won't aggregate across multiple `backend` replicas.
- No dead-letter-queue UI or admin endpoint for replaying failed jobs.
- `VITE_API_KEY` is **baked into the SPA bundle** for demo convenience. Real users should authenticate against the backend and obtain a session token — never bundle a static credential.
- Worker does not implement idempotency keys: a BullMQ retry after a partial DB write could overwrite an in-flight status. Acceptable for the simulated workload; a real scraper should `UPDATE … WHERE status='processing' AND attempt=$N`.

## 8. What I would improve with more time

- **Auth**: replace API keys with OAuth2 / JWT bearer flow; per-user dashboards.
- **Distributed rate limiting**: `slowapi` + Redis storage backend or NGINX `limit_req_zone`.
- **Observability**: Prometheus metrics from FastAPI (`fastapi-prometheus`) and BullMQ (`bullmq-otel`); traces via OpenTelemetry; dashboards in Grafana.
- **Admin UI**: a `/admin` route showing queue depth, worker concurrency, DLQ; ability to retry / cancel jobs.
- **Idempotency** on worker writes (compare-and-set on status).
- **E2E tests** with Playwright driving the dashboard against a live compose stack.
- **TLS termination** via Caddy / Traefik with automatic Let's Encrypt.

## 9. Backup / recovery strategy

**Postgres**
- Continuous WAL archiving + nightly `pg_basebackup` to S3 (`wal-g` or managed RDS).
- Target RPO 5 min, RTO 30 min. Restore: replay WAL onto the latest basebackup.
- For this compose setup, the simplest recipe: `docker compose exec postgres pg_dump -U jobs jobs > backup.sql` on cron.

**Redis**
- Already runs with `--appendonly yes` (AOF) for durability between snapshots.
- RDB snapshot every hour (`save 3600 1`) copied off-host.
- **The queue is recoverable from Postgres** in a worst case: a startup repair job can re-enqueue rows with `status='queued'` or `status='processing'` (treating processing as crashed mid-flight) since Postgres is the source of truth. This was a deliberate design choice.

## 10. Production deployment considerations

- Replace the single-host `docker compose` with managed services where possible: managed Postgres (RDS / Cloud SQL), managed Redis (ElastiCache / Memorystore), with PrivateLink to the worker.
- Run multiple `worker` replicas — BullMQ handles distribution; tune `WORKER_CONCURRENCY` per CPU.
- Run multiple `backend` replicas behind an L7 LB. Sticky sessions are **not** required for SSE because each connection is independent and re-subscribes on reconnect.
- Terminate TLS at NGINX / Caddy / cloud LB; pass `X-Forwarded-For` and add it to `structlog` context.
- Secrets via Vault / AWS Secrets Manager / SSM — inject as env at start.
- Ship structured logs to Loki / ELK; alert on `unhandled_error`, `health_*_failed`, and queue depth.
- Kubernetes: liveness probe hits `/health`, readiness probe checks `db` + `redis` are `up`. Worker uses preStop SIGTERM + 30 s grace.

---

## License

This codebase is delivered as part of a hiring evaluation. Not licensed for redistribution.
