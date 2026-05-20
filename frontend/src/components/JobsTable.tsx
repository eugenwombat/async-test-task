import type { Job } from "../types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  jobs: Job[];
}

const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString() : "—");

export function JobsTable({ jobs }: Props) {
  if (jobs.length === 0) {
    return <p className="text-slate-500 italic">No jobs yet. Submit one above.</p>;
  }
  return (
    <div className="bg-white rounded shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="px-3 py-2">Job ID</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">URL</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2">Result / Error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.job_id} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{job.job_id.slice(0, 8)}…</td>
              <td className="px-3 py-2"><StatusBadge status={job.status} /></td>
              <td className="px-3 py-2 truncate max-w-[200px]" title={job.url}>{job.url ?? "—"}</td>
              <td className="px-3 py-2">{job.job_type ?? "—"}</td>
              <td className="px-3 py-2 text-slate-500">{fmtTime(job.updated_at)}</td>
              <td className="px-3 py-2 text-xs">
                {job.status === "failed" && <span className="text-red-700">{job.error ?? "failed"}</span>}
                {job.status === "completed" && job.result && (
                  <span className="text-slate-700">{(job.result as { title?: string }).title ?? "ok"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
