import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { ApiError, errorResponse } from "@/lib/api-contracts";
import { errorResponseBodyForLog } from "@/lib/request-logging";

const rejected = new ApiError({
  status: 400,
  code: "ambiguous_taxpayer_name",
  type: "validation_error",
  message: "Rejected.",
  param: "taxpayer",
  logReason: "unsupported_particle",
});

describe("errorResponseBodyForLog", () => {
  it("records the internal reason in the log without exposing it to the client", async () => {
    const response = errorResponse(rejected, "req_1");

    const logged = JSON.parse((await errorResponseBodyForLog(response, rejected.logReason)) ?? "null");

    expect(logged).toMatchObject({
      internal_reason: "unsupported_particle",
      error: { code: "ambiguous_taxpayer_name" },
      request_id: "req_1",
    });
    expect(await response.text()).not.toContain("unsupported_particle");
  });

  it("logs the body unchanged when there is no internal reason", async () => {
    const response = errorResponse(new ApiError({
      status: 400, code: "missing_field", type: "validation_error", message: "Missing.",
    }), "req_2");

    expect(await errorResponseBodyForLog(response)).toBe(await response.clone().text());
  });

  it("does not log successful responses", async () => {
    expect(await errorResponseBodyForLog(new Response("{}", { status: 201 }), "ignored")).toBeNull();
  });
});
