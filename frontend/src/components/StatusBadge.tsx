import type { JobStatus } from "../types";

const styles: Record<JobStatus, string> = {
  queued: "bg-slate-200 text-slate-700",
  processing: "bg-blue-200 text-blue-800",
  completed: "bg-green-200 text-green-800",
  failed: "bg-red-200 text-red-800",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
