import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SubmitForm } from "../SubmitForm";

vi.mock("../../api", () => ({
  submitJob: vi.fn(async (url: string, jobType: string) => ({
    job_id: "abc",
    status: "queued",
  })),
}));

import { submitJob } from "../../api";

describe("SubmitForm", () => {
  beforeEach(() => {
    (submitJob as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it("calls submitJob with url + job_type on submit", async () => {
    const onSubmitted = vi.fn();
    render(<SubmitForm onSubmitted={onSubmitted} />);
    const input = screen.getByPlaceholderText("https://example.com");
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(submitJob).toHaveBeenCalled());
    expect(submitJob).toHaveBeenCalledWith("https://example.com", "extract");
    expect(onSubmitted).toHaveBeenCalledWith({
      job_id: "abc",
      status: "queued",
      url: "https://example.com",
      job_type: "extract",
    });
  });
});
