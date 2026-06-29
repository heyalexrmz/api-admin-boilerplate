import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FACTURADOR_WEBHOOK_EVENTS } from "./api-contracts";
import {
  invoiceFailedWebhookPayload,
  invoiceFinalizedWebhookPayload,
  ticketWebhookRequestMetadata,
  ticketFinalResponseView,
  ticketProviderResponseView,
} from "./facturador/responses";
import { submitToTocino } from "./facturador/tocino";
import { createTocinoWebhookJobValues } from "./facturador/upstream-webhooks";
import { documentObjectKey, sanitizeObjectKeySegment } from "./storage/s3";

describe("FACTURADOR_WEBHOOK_EVENTS", () => {
  it("contains the primary customer-facing ticket events", () => {
    expect(FACTURADOR_WEBHOOK_EVENTS).toContain("ticket.finalized");
    expect(FACTURADOR_WEBHOOK_EVENTS).toContain("ticket.failed");
    expect(FACTURADOR_WEBHOOK_EVENTS).toContain("invoice.finalized");
    expect(FACTURADOR_WEBHOOK_EVENTS).toContain("invoice.failed");
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

describe("ticketWebhookRequestMetadata", () => {
  it("uses the public ticket id as the webhook request id", () => {
    expect(
      ticketWebhookRequestMetadata({
        ticketId: "4ebd2d48-193f-4859-8fc6-8b2c8931f497",
        idempotencyKey: "idem_123",
        livemode: true,
      })
    ).toEqual({
      id: "4ebd2d48-193f-4859-8fc6-8b2c8931f497",
      idempotencyKey: "idem_123",
      livemode: true,
    });
  });
});

describe("submitToTocino", () => {
  it("returns the provider request id without exposing the upstream provider name", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ nova_request_id: "nova_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitToTocino({
      idempotencyKey: "ticket_123",
      body: { tax_id: "RFC123" },
      config: {
        baseUrl: "https://upstream.example",
        apiKey: "api_key",
        webhookHeader: "typeform-signature",
        webhookToken: "webhook_token",
        webhookSecret: "webhook_secret",
        assetHosts: [],
      },
    });

    expect(JSON.stringify(result)).not.toContain("tocino");
    expect(result).toEqual({
      ok: true,
      novaRequestId: "nova_123",
      raw: { nova_request_id: "nova_123" },
    });
  });
});

describe("createTocinoWebhookJobValues", () => {
  it("uses upstream identifiers to make processing idempotent", () => {
    expect(
      createTocinoWebhookJobValues({
        organizationId: "org_123",
        raw: {
          idempotency_key: "ticket_123",
          nova_request_id: "nova_123",
          invoice: { id: "invoice_123" },
        },
      })
    ).toEqual({
      organizationId: "org_123",
      type: "process_upstream_webhook",
      payload: {
        raw: {
          idempotency_key: "ticket_123",
          nova_request_id: "nova_123",
          invoice: { id: "invoice_123" },
        },
      },
      idempotencyKey: "process_upstream_webhook:nova_request_id:nova_123",
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

describe("invoiceFinalizedWebhookPayload", () => {
  it("uses only the internal ticket id for correlation and includes documents", () => {
    const payload = invoiceFinalizedWebhookPayload({
      ticket: {
        id: "ticket_123",
        livemode: true,
      },
      invoice: {
        id: "invoice_123",
        status: "finalized",
        uuid: "SAT_UUID_123",
        series: "A",
        folio: "123",
        issuerTaxpayer: "Merchant",
        issuerRfc: "MERCHANT123",
        total: "696.00",
        invoiceDate: "2026-06-29T20:04:00.000Z",
      },
      documents: [
        {
          id: "doc_xml",
          kind: "invoice_xml",
          content_type: "application/xml",
          bytes: 123,
          url: "https://example.test/doc_xml",
          created_at: "2026-06-29T20:05:00.000Z",
        },
      ],
    });

    expect(payload).toEqual({
      object: "invoice",
      id: "invoice_123",
      status: "finalized",
      ticket_id: "ticket_123",
      livemode: true,
      uuid: "SAT_UUID_123",
      series: "A",
      folio: "123",
      issuer_taxpayer: "Merchant",
      issuer_rfc: "MERCHANT123",
      total: "696.00",
      invoice_date: "2026-06-29T20:04:00.000Z",
      documents: [
        {
          id: "doc_xml",
          kind: "invoice_xml",
          content_type: "application/xml",
          bytes: 123,
          url: "https://example.test/doc_xml",
          created_at: "2026-06-29T20:05:00.000Z",
        },
      ],
    });
  });
});

describe("invoiceFailedWebhookPayload", () => {
  it("uses only the internal ticket id for correlation and includes error details", () => {
    const payload = invoiceFailedWebhookPayload({
      ticket: {
        id: "ticket_123",
        livemode: true,
      },
      error: {
        code: "NOT_INVOICEABLE",
        type: "site",
        message: "This ticket cannot be invoiced.",
      },
    });

    expect(payload).toEqual({
      object: "invoice",
      status: "failed",
      ticket_id: "ticket_123",
      livemode: true,
      error: {
        code: "NOT_INVOICEABLE",
        type: "site",
        message: "This ticket cannot be invoiced.",
      },
    });
  });
});
