import { config } from "./config.js";
import { updateJobStatus } from "./db.js";
import { publishJobEvent } from "./events.js";
import { logger } from "./logger.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function buildProcessor(deps = {}) {
  const _updateJobStatus = deps.updateJobStatus || updateJobStatus;
  const _publishJobEvent = deps.publishJobEvent || publishJobEvent;
  const _sleep = deps.sleep || sleep;
  const _random = deps.random || Math.random;

  return async function processJob(job) {
    const { job_id: jobId, url, job_type: jobType } = job.data;
    const log = logger.child({ job_id: jobId, bullmq_id: job.id, attempt: job.attemptsMade + 1 });

    log.info({ url, job_type: jobType }, "processing_started");
    const processingRow = await _updateJobStatus(jobId, "processing");
    await _publishJobEvent({
      job_id: jobId,
      status: "processing",
      updated_at: processingRow?.updated_at,
    });

    const durationMs = randomBetween(config.minProcessingMs, config.maxProcessingMs);
    await _sleep(durationMs);

    const shouldFail = _random() < config.failureRate;

    if (shouldFail) {
      const errorMsg = "Simulated random failure";
      const failedRow = await _updateJobStatus(jobId, "failed", { error: errorMsg });
      await _publishJobEvent({
        job_id: jobId,
        status: "failed",
        error: errorMsg,
        updated_at: failedRow?.updated_at,
      });
      log.warn({ duration_ms: durationMs }, "job_failed");
      throw new Error(errorMsg);
    }

    const result = {
      title: `Result for ${url}`,
      summary: "Fake extracted content",
      processed_by: config.workerId,
      duration_ms: durationMs,
    };
    const completedRow = await _updateJobStatus(jobId, "completed", { result });
    await _publishJobEvent({
      job_id: jobId,
      status: "completed",
      result,
      updated_at: completedRow?.updated_at,
    });

    log.info({ duration_ms: durationMs }, "job_completed");
    return result;
  };
}

export const processJob = buildProcessor();
