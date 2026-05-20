import { Worker } from "bullmq";
import { config, redisConnection } from "./config.js";
import { closeDb } from "./db.js";
import { closeEvents } from "./events.js";
import { logger } from "./logger.js";
import { processJob } from "./processor.js";

const worker = new Worker(config.queueName, processJob, {
  connection: redisConnection,
  concurrency: config.concurrency,
});

worker.on("ready", () => {
  logger.info({ queue: config.queueName, concurrency: config.concurrency }, "worker_ready");
});
worker.on("failed", (job, err) => {
  logger.warn(
    { job_id: job?.data?.job_id, bullmq_id: job?.id, error: err?.message },
    "bullmq_failed"
  );
});
worker.on("error", (err) => {
  logger.error({ error: err.message }, "worker_error");
});

async function shutdown(signal) {
  logger.info({ signal }, "shutdown_initiated");
  try {
    await worker.close();
    await closeDb();
    await closeEvents();
  } catch (err) {
    logger.error({ error: err.message }, "shutdown_error");
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
