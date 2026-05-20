import { URL } from "node:url";

const parseRedis = (urlStr) => {
  const url = new URL(urlStr);
  return {
    host: url.hostname || "redis",
    port: Number(url.port) || 6379,
    db: Number((url.pathname || "/0").replace("/", "")) || 0,
    password: url.password || undefined,
  };
};

export const config = {
  workerId: process.env.WORKER_ID || `worker-${process.pid}`,
  databaseUrl:
    process.env.DATABASE_URL_PG ||
    "postgres://jobs:jobs@postgres:5432/jobs",
  redisUrl: process.env.REDIS_URL || "redis://redis:6379/0",
  queueName: process.env.BULL_QUEUE_NAME || "jobs",
  eventsChannel: process.env.BULL_EVENTS_CHANNEL || "job-events",
  failureRate: Number(process.env.WORKER_FAILURE_RATE ?? "0.1"),
  minProcessingMs: Number(process.env.WORKER_MIN_MS ?? "5000"),
  maxProcessingMs: Number(process.env.WORKER_MAX_MS ?? "15000"),
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? "4"),
};

export const redisConnection = parseRedis(config.redisUrl);
