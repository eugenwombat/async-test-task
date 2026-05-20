import type { Job } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

const headers = (): HeadersInit => ({
  "Content-Type": "application/json",
  "X-API-Key": API_KEY,
});

export async function submitJob(url: string, jobType: string): Promise<{ job_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ url, job_type: jobType }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Submit failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function listJobs(limit = 50): Promise<Job[]> {
  const res = await fetch(`${API_BASE}/jobs?limit=${limit}`, { headers: headers() });
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  const data = await res.json();
  return data.jobs ?? [];
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Get job failed (${res.status})`);
  return res.json();
}
