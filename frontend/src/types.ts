export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface Job {
  job_id: string;
  status: JobStatus;
  url?: string;
  job_type?: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface JobUpdate {
  job_id: string;
  status: JobStatus;
  result?: Record<string, unknown>;
  error?: string;
  updated_at?: string;
}
