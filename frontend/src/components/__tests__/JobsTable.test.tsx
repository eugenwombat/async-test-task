import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobsTable } from "../JobsTable";

describe("JobsTable", () => {
  it("shows empty state when no jobs", () => {
    render(<JobsTable jobs={[]} />);
    expect(screen.getByText(/no jobs yet/i)).toBeInTheDocument();
  });

  it("renders job rows with status", () => {
    render(
      <JobsTable
        jobs={[
          {
            job_id: "11111111-2222-3333-4444-555555555555",
            status: "completed",
            url: "https://example.com",
            job_type: "extract",
            result: { title: "Example Domain" },
          },
        ]}
      />
    );
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("Example Domain")).toBeInTheDocument();
  });
});
