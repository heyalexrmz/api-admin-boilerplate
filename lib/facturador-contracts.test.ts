import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FACTURADOR_WEBHOOK_EVENTS } from "./api-contracts";
import {
  ticketFinalResponseView,
  ticketProviderResponseView,
} from "./facturador/responses";
import { documentObjectKey, sanitizeObjectKeySegment } from "./storage/s3";

describe("FACTURADOR_WEBHOOK_EVENTS", () => {
  it("contains the primary customer-facing ticket events", () => {
    expect(FACTURADOR_WEBHOOK_EVENTS).toContain("ticket.finalized");
    expect(FACTURADOR_WEBHOOK_EVENTS).toContain("ticket.failed");
  });

  it("does not duplicate event names", () => {
    expect(new Set(FACTURADOR_WEBHOOK_EVENTS).size).toBe(
      FACTURADOR_WEBHOOK_EVENTS.length
    );
  });
});

describe("documentObjectKey", () => {
  it("uses the organization, taxpayer RFC, ticket, and document hierarchy", () => {
    expect(
      documentObjectKey({
        organizationId: "org 1",
        rfc: "abc 123",
        ticketId: "ticket/1",
        documentId: "doc:1",
        fileName: "ticket image.jpg",
      })
    ).toBe("organizations/org_1/taxpayers/ABC_123/tickets/ticket_1/doc_1-ticket_image.jpg");
  });
});

describe("sanitizeObjectKeySegment", () => {
  it("keeps only S3-key-safe segment characters", () => {
    expect(sanitizeObjectKeySegment("a b/c:d.pdf")).toBe("a_b_c_d.pdf");
  });
});

describe("ticketProviderResponseView", () => {
  it("does not leak provider response fields", () => {
    const view = ticketProviderResponseView({
      ticketId: "ticket_123",
      status: "pending",
      livemode: true,
    });

    expect(JSON.stringify(view)).not.toContain("nova");
    expect(JSON.stringify(view)).not.toContain("tocino");
    expect(view).toEqual({
      object: "ticket_response",
      ticket_id: "ticket_123",
      status: "pending",
      livemode: true,
      message: "Ticket submitted for processing.",
      error: null,
    });
  });
});

describe("ticketFinalResponseView", () => {
  it("constructs a normalized final response without upstream fields", () => {
    const view = ticketFinalResponseView({
      ticketId: "ticket_123",
      status: "finalized",
      livemode: true,
      invoiceId: "invoice_123",
      invoiceUuid: "sat_uuid_123",
      error: null,
    });

    expect(JSON.stringify(view)).not.toContain("nova_request_id");
    expect(view).toEqual({
      object: "ticket_final_response",
      ticket_id: "ticket_123",
      status: "finalized",
      livemode: true,
      invoice: {
        id: "invoice_123",
        uuid: "sat_uuid_123",
      },
      error: null,
    });
  });
});
