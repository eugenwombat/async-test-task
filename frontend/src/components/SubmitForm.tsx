import { useState } from "react";
import { submitJob } from "../api";

interface Props {
  onSubmitted: (job: { job_id: string; status: string; url: string; job_type: string }) => void;
}

export function SubmitForm({ onSubmitted }: Props) {
  const [url, setUrl] = useState("");
  const [jobType, setJobType] = useState("extract");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const job = await submitJob(url, jobType);
      onSubmitted({ ...job, url, job_type: jobType });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded shadow p-4 space-y-3">
      <h2 className="font-semibold text-lg">Submit job</h2>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_120px] gap-2">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="border rounded px-3 py-2"
        />
        <select
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="extract">extract</option>
          <option value="screenshot">screenshot</option>
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white rounded px-3 py-2 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
      {error && <p className="text-red-700 text-sm">{error}</p>}
    </form>
  );
}
