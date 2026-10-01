import { describe, expect, it } from "vitest";
import { publicTicketError } from "./public-errors";
import { invoiceFailedWebhookPayload, ticketFinalResponseView, ticketProviderResponseView } from "./responses";
import { mapTocinoError } from "./tocino";

describe("public error contract", () => {
  const privateError = {
    code: "TOCINO_FAILURE", type: "site",
    message: "Tocino / Nova: RFC inválido; https://api.tocino.example/private nova_request_id",
  };

  it("keeps the actionable reason while removing service identity and internal URLs", () => {
    const error = publicTicketError(privateError);
    expect(error?.message).toContain("RFC inválido");
    expect(error?.code).toBe("UNKNOWN_UPSTREAM");
    expect(JSON.stringify(error)).not.toMatch(/tocino|nova|https:\/\//i);
  });

  it("normalizes historical throttling to quota", () => {
    expect(publicTicketError({
      code: "UPSTREAM_VALIDATION", type: "validation",
      message: "Request was throttled. Expected available in 35115 seconds.",
    })).toMatchObject({ code: "UPSTREAM_RATE_LIMITED", type: "quota" });
  });

  it("sanitizes merchant errors before they enter ticket failure webhooks", () => {
    const error = mapTocinoError("process", {
      status: "failed", error_code: privateError.code, error_msg: privateError.message,
    });
    expect(error.message).toContain("RFC inválido");
    expect(JSON.stringify(error)).not.toMatch(/tocino|nova/i);
  });

  it("protects response and invoice webhook serializers for existing stored errors", () => {
    const views = [
      ticketProviderResponseView({ ticketId: "ticket-1", status: "failed", livemode: true, error: privateError }),
      ticketFinalResponseView({ ticketId: "ticket-1", status: "failed", livemode: true, invoiceId: null, invoiceUuid: null, error: privateError }),
      invoiceFailedWebhookPayload({ ticket: { id: "ticket-1", livemode: true }, error: privateError }),
    ];
    expect(JSON.stringify(views)).not.toMatch(/tocino|nova|https:\/\//i);
    for (const view of views) expect(view.error?.message).toContain("RFC inválido");
  });
});
