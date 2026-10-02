import { describe, expect, it } from "vitest";
import { canRetryTicketSubmission } from "./retry-eligibility";

const failedSubmission = {
  status: "failed", providerRequestId: null, invoiceId: null,
  upstreamRaw: { phase: "submit", http_status: 500, body: { message: "Internal error" } },
};

describe("manual ticket retry eligibility", () => {
  it("allows the reported submission failure and historical throttling failures", () => {
    expect(canRetryTicketSubmission(failedSubmission)).toBe(true);
    expect(canRetryTicketSubmission({ ...failedSubmission, upstreamRaw: { phase: "submit", http_status: 429 } })).toBe(true);
  });

  it.each(["received", "queued", "processing", "pending", "finalized", "cancelled", "not_invoiceable"])("does not offer retry for %s tickets", (status) => {
    expect(canRetryTicketSubmission({ ...failedSubmission, status })).toBe(false);
  });

  it("requires both an unconfirmed submission and no invoice", () => {
    expect(canRetryTicketSubmission({ ...failedSubmission, providerRequestId: "accepted" })).toBe(false);
    expect(canRetryTicketSubmission({ ...failedSubmission, invoiceId: "existing-invoice" })).toBe(false);
  });

  it.each([null, {}, { phase: "process" }, { phase: "intake" }])("does not resubmit failures from other phases: %j", (upstreamRaw) => {
    expect(canRetryTicketSubmission({ ...failedSubmission, upstreamRaw })).toBe(false);
  });
});
