import { useCallback, useEffect, useState } from "react";
import { SubmitForm } from "./components/SubmitForm";
import { JobsTable } from "./components/JobsTable";
import { getJob, listJobs } from "./api";
import { useJobEvents } from "./hooks/useJobEvents";
import type { Job, JobStatus, JobUpdate } from "./types";

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listJobs(50)
      .then(setJobs)
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const handleSubmitted = useCallback(
    (created: { job_id: string; status: string; url: string; job_type: string }) => {
      setJobs((prev) => [
        {
          job_id: created.job_id,
          status: created.status as JobStatus,
          url: created.url,
          job_type: created.job_type,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    []
  );

  const handleUpdate = useCallback((update: JobUpdate) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.job_id === update.job_id);
      if (idx === -1) {
        getJob(update.job_id)
          .then((job) => setJobs((curr) => (curr.some((j) => j.job_id === job.job_id) ? curr : [job, ...curr])))
          .catch(() => {});
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        status: update.status,
        result: update.result ?? next[idx].result,
        error: update.error ?? next[idx].error,
        updated_at: update.updated_at ?? next[idx].updated_at,
      };
      return next;
    });
  }, []);

  useJobEvents(handleUpdate);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Async Jobs Dashboard</h1>
        <p className="text-slate-600 text-sm">Submit jobs and watch status update in real time via SSE.</p>
      </header>
      <SubmitForm onSubmitted={handleSubmitted} />
      {loadError && <p className="text-red-700 text-sm">Failed to load jobs: {loadError}</p>}
      <JobsTable jobs={jobs} />
    </div>
  );
}
