import { describe, it, expect, vi } from "vitest";
import { buildProcessor } from "../src/processor.js";

const makeJob = () => ({
  id: "bull-1",
  attemptsMade: 0,
  data: { job_id: "job-uuid", url: "https://example.com", job_type: "extract" },
});

describe("processJob", () => {
  it("transitions queued -> processing -> completed and publishes events", async () => {
    const updates = [];
    const events = [];
    const proc = buildProcessor({
      updateJobStatus: async (id, status, extra = {}) => {
        updates.push({ id, status, ...extra });
        return { id, status, updated_at: "2026-05-19T00:00:00Z" };
      },
      publishJobEvent: async (payload) => events.push(payload),
      sleep: async () => {},
      random: () => 0.99, // > failureRate (0.1) → never fails
    });

    const result = await proc(makeJob());
    expect(result.processed_by).toBeDefined();
    expect(updates.map((u) => u.status)).toEqual(["processing", "completed"]);
    expect(events.map((e) => e.status)).toEqual(["processing", "completed"]);
    expect(events[1].result).toBeDefined();
  });

  it("marks job failed when random < failureRate", async () => {
    const updates = [];
    const events = [];
    const proc = buildProcessor({
      updateJobStatus: async (id, status, extra = {}) => {
        updates.push({ id, status, ...extra });
        return { id, status };
      },
      publishJobEvent: async (payload) => events.push(payload),
      sleep: async () => {},
      random: () => 0.0, // < failureRate (0.1) → always fails
    });

    await expect(proc(makeJob())).rejects.toThrow(/Simulated/);
    expect(updates.map((u) => u.status)).toEqual(["processing", "failed"]);
    expect(events.map((e) => e.status)).toEqual(["processing", "failed"]);
    expect(events[1].error).toMatch(/Simulated/);
  });
});
