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
import { normalizeTicketSubmitFields } from "./facturador/submit-fields";
import { tocinoSubmitBody } from "./facturador/provider-submit";
import {
  classifyTocinoEvent,
  extractTocinoInvoice,
  mapTocinoError,
  parseCfdiIdentifiers,
  submitToTocino,
  tocinoTicketId,
} from "./facturador/tocino";
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

describe("normalizeTicketSubmitFields", () => {
  it("accepts taxpayer for personas morales", () => {
    expect(
      normalizeTicketSubmitFields({
        tax_id: "EKU9003173C9",
        taxpayer: " Empresa Demo ",
      })
    ).toMatchObject({
      tax_id: "EKU9003173C9",
      taxpayer: "Empresa Demo",
    });
  });

  it("accepts Tocino persona fisica name fields", () => {
    expect(
      normalizeTicketSubmitFields({
        tax_id: "GODE561231GR8",
        taxpayer_name: " ALEJANDRO ",
        taxpayer_last_name: " DOMINGUEZ ",
        taxpayer_second_last_name: " RAMIREZ ",
      })
    ).toMatchObject({
      tax_id: "GODE561231GR8",
      taxpayer_name: "ALEJANDRO",
      taxpayer_last_name: "DOMINGUEZ",
      taxpayer_second_last_name: "RAMIREZ",
    });
  });

  it("requires taxpayer or a complete persona fisica identity", () => {
    expect(() =>
      normalizeTicketSubmitFields({
        tax_id: "GODE561231GR8",
        taxpayer_name: "ALEJANDRO",
      })
    ).toThrow("taxpayer_last_name is required for persona fisica");
  });
});

describe("submitToTocino", () => {
  it("maps upstream validation detail into an actionable submit error", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          detail: [
            {
              loc: ["body", "country"],
              msg: "Extra inputs are not permitted",
              type: "extra_forbidden",
            },
          ],
        }),
        {
          status: 422,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitToTocino({
      idempotencyKey: "ticket_123",
      body: {
        tax_id: "EKU9003173C9",
        taxpayer_name: "Empresa Demo SA de CV",
        file: "base64_ticket_image",
      },
      config: {
        baseUrl: "https://upstream.example",
        apiKey: "api_key",
        webhookHeader: "typeform-signature",
        webhookToken: "webhook_token",
        webhookSecret: "webhook_secret",
        assetHosts: [],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      status: 422,
      error: {
        code: "UPSTREAM_VALIDATION",
        category: "validation",
        message: "Extra inputs are not permitted",
      },
    });
  });

  it("preserves non-json upstream submit errors", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("Invalid request body", {
        status: 400,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitToTocino({
      idempotencyKey: "ticket_123",
      body: {
        tax_id: "EKU9003173C9",
        taxpayer_name: "Empresa Demo SA de CV",
        file: "base64_ticket_image",
      },
      config: {
        baseUrl: "https://upstream.example",
        apiKey: "api_key",
        webhookHeader: "typeform-signature",
        webhookToken: "webhook_token",
        webhookSecret: "webhook_secret",
        assetHosts: [],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      raw: { message: "Invalid request body" },
      error: {
        code: "UPSTREAM_REJECTED",
        category: "upstream",
        message: "Invalid request body",
      },
    });
  });

  it("forwards taxpayer for personas morales", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ ticket_id: "nova_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitToTocino({
      idempotencyKey: "ticket_123",
      body: {
        tax_id: "EKU9003173C9",
        taxpayer: "Empresa Demo",
        file: "base64_ticket_image",
        file_name: "ticket.jpg",
      },
      config: {
        baseUrl: "https://upstream.example",
        apiKey: "api_key",
        webhookHeader: "typeform-signature",
        webhookToken: "webhook_token",
        webhookSecret: "webhook_secret",
        assetHosts: [],
      },
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      tax_id: "EKU9003173C9",
      taxpayer: "Empresa Demo",
      file: "base64_ticket_image",
      file_name: "ticket.jpg",
    });
  });

  it("forwards Tocino persona fisica name fields", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ ticket_id: "nova_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitToTocino({
      idempotencyKey: "ticket_123",
      body: {
        tax_id: "GODE561231GR8",
        taxpayer_name: "ALEJANDRO",
        taxpayer_last_name: "DOMINGUEZ",
        taxpayer_second_last_name: "RAMIREZ",
        file: "base64_ticket_image",
        file_name: "ticket.jpg",
      },
      config: {
        baseUrl: "https://upstream.example",
        apiKey: "api_key",
        webhookHeader: "typeform-signature",
        webhookToken: "webhook_token",
        webhookSecret: "webhook_secret",
        assetHosts: [],
      },
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      tax_id: "GODE561231GR8",
      taxpayer_name: "ALEJANDRO",
      taxpayer_last_name: "DOMINGUEZ",
      taxpayer_second_last_name: "RAMIREZ",
      file: "base64_ticket_image",
      file_name: "ticket.jpg",
    });
  });

  it("returns the provider request id without exposing the upstream provider name", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ticket_id: "nova_123" }), {
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
      providerTicketId: "nova_123",
      raw: { ticket_id: "nova_123" },
    });
  });
});

describe("tocinoSubmitBody", () => {
  it("sends only provider fields and internal defaults to Tocino", () => {
    expect(
      tocinoSubmitBody({
        storedFields: {
          tax_id: "EKU9003173C9",
          taxpayer: "Empresa Demo",
          taxpayer_name: "ALEJANDRO",
          taxpayer_last_name: "DOMINGUEZ",
          taxpayer_second_last_name: "RAMIREZ",
          file_content_type: "image/jpeg",
          csf_pdf_file_name: "csf.pdf",
          csf_pdf_content_type: "application/pdf",
          invoice_fiscal_regimen: "612",
          invoice_cfdi_use: "G03",
        },
        imageBase64: "base64_ticket_image",
        fileName: "ticket.jpg",
        csfBase64: "base64_csf_pdf",
      })
    ).toEqual({
      tax_id: "EKU9003173C9",
      taxpayer: "Empresa Demo",
      taxpayer_name: "ALEJANDRO",
      taxpayer_last_name: "DOMINGUEZ",
      taxpayer_second_last_name: "RAMIREZ",
      fiscal_regimen_code: "612",
      cfdi_use_code: "G03",
      country: "México",
      file: "base64_ticket_image",
      filename: "ticket.jpg",
      csf_pdf: "base64_csf_pdf",
    });
  });

  it("adds Tocino taxpayer from persona fisica name fields when missing", () => {
    expect(
      tocinoSubmitBody({
        storedFields: {
          tax_id: "DORA990310A30",
          taxpayer_name: "ALEJANDRO",
          taxpayer_last_name: "DOMINGUEZ",
          taxpayer_second_last_name: "RAMIREZ",
          invoice_fiscal_regimen: "626",
          invoice_cfdi_use: "G03",
        },
        imageBase64: "base64_ticket_image",
        fileName: "ticket.jpg",
      })
    ).toEqual({
      tax_id: "DORA990310A30",
      taxpayer: "ALEJANDRO DOMINGUEZ RAMIREZ",
      taxpayer_name: "ALEJANDRO",
      taxpayer_last_name: "DOMINGUEZ",
      taxpayer_second_last_name: "RAMIREZ",
      fiscal_regimen_code: "626",
      cfdi_use_code: "G03",
      country: "México",
      file: "base64_ticket_image",
      filename: "ticket.jpg",
    });
  });

  it("keeps fiscal codes when a retry reads a request stored with provider names", () => {
    expect(
      tocinoSubmitBody({
        storedFields: {
          tax_id: "EKU9003173C9",
          taxpayer: "Empresa Demo",
          fiscal_regimen_code: "601",
          cfdi_use_code: "G03",
          file: "<base64 omitted: 8 chars>",
        },
        imageBase64: "base64_ticket_image",
        fileName: "ticket.jpg",
      })
    ).toMatchObject({ fiscal_regimen_code: "601", cfdi_use_code: "G03", file: "base64_ticket_image" });
  });
});

describe("Tocino external tickets contract", () => {
  it("posts to the external tickets endpoint and keeps the returned ticket_id", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({
        message: "Ticket received",
        ticket_id: "2f502648-44cd-49f0-94b1-ab307cda8295",
        internal_id: "89fc579c-be0a-49c1-a320-78ce81864871",
      }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitToTocino({
      idempotencyKey: "ticket_123",
      body: {},
      config: {
        baseUrl: "https://bacon.tocino.ai/",
        apiKey: "api_key",
        webhookHeader: "typeform-signature",
        webhookToken: "webhook_token",
        webhookSecret: "webhook_secret",
        assetHosts: [],
      },
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://bacon.tocino.ai/api/external/tickets/");
    expect(result).toMatchObject({ ok: true, providerTicketId: "2f502648-44cd-49f0-94b1-ab307cda8295" });
  });

  it("matches callbacks by ticket_id and falls back to the previous identifier", () => {
    expect(tocinoTicketId({ ticket_id: " new ", nova_request_id: "old" })).toBe("new");
    expect(tocinoTicketId({ nova_request_id: "old" })).toBe("old");
    expect(tocinoTicketId({ ticket_id: null })).toBeNull();
  });

  it("reads a finalized callback with direct document links", () => {
    const raw = {
      status: "finalized",
      file_url: "https://assets.example/ticket.jpg",
      ticket_id: "016df394-5973-47dd-8d8f-154eedea3b31",
      idempotency_key: "1234563",
      invoice: {
        pdf: "https://assets.example/invoice.pdf",
        xml: "https://assets.example/invoice.xml",
        invoice_date: "2026-02-07T19:12:37-06:00",
        issuer_taxid: "NWM9709244W4",
        invoice_total: "4167.50",
        issuer_taxpayer: "NUEVA WAL MART DE MEXICO",
      },
    };
    expect(classifyTocinoEvent(raw)).toBe("ticket.finalized");
    expect(extractTocinoInvoice(raw)).toMatchObject({
      pdfUrl: "https://assets.example/invoice.pdf",
      xmlUrl: "https://assets.example/invoice.xml",
      issuerRfc: "NWM9709244W4",
      issuerTaxpayer: "NUEVA WAL MART DE MEXICO",
      total: "4167.50",
      invoiceDate: "2026-02-07T19:12:37-06:00",
      satUuid: null,
    });
  });

  it("reads a not-invoiceable callback with the cause at its root", () => {
    const raw = {
      status: "not_invoiceable",
      invoice: "",
      ticket_id: "ca511620-14c6-4b31-a3b5-a8babaa65afa",
      not_invoiceable_cause: "La imagen no es un ticket.",
    };
    expect(classifyTocinoEvent(raw)).toBe("ticket.failed");
    expect(mapTocinoError("process", raw)).toEqual({
      code: "NOT_INVOICEABLE",
      category: "site",
      message: "La imagen no es un ticket.",
    });
  });

  it("takes the SAT identifiers from the CFDI", () => {
    expect(parseCfdiIdentifiers(Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <cfdi:Comprobante Version="4.0" Serie="A" Folio="123" Total="10.00">
        <cfdi:Emisor Rfc="NWM9709244W4" Nombre="A > B"/>
        <cfdi:Complemento>
          <tfd:TimbreFiscalDigital Version="1.1"
            UUID='6128396F-C09B-4EC6-8699-43C5F7E3B230' SelloCFD="abc"/>
        </cfdi:Complemento>
      </cfdi:Comprobante>`))).toEqual({
      satUuid: "6128396F-C09B-4EC6-8699-43C5F7E3B230",
      series: "A",
      folio: "123",
    });
    expect(parseCfdiIdentifiers(Buffer.from('<Invoice total="1" />'))).toEqual({
      satUuid: null,
      series: null,
      folio: null,
    });
  });

  it("does not treat an invoicing ticket as finished", () => {
    expect(classifyTocinoEvent({ status: "invoicing", invoice: null })).toBeNull();
    expect(classifyTocinoEvent({ status: "invoicing", invoice: { id: "partial" } })).toBeNull();
  });

  it("reports a field error under the name our API uses", () => {
    expect(
      mapTocinoError("submit", { fiscal_regimen_code: ["This field is required."] }, 400)
    ).toMatchObject({
      code: "UPSTREAM_VALIDATION",
      category: "validation",
      message: "invoice_fiscal_regimen: This field is required.",
    });
  });
});

describe("mapTocinoError", () => {
  it("uses upstream messages when the submit response is not a known field error", () => {
    expect(mapTocinoError("submit", { error: "Invalid taxpayer payload." })).toEqual({
      code: "UPSTREAM_REJECTED",
      category: "upstream",
      message: "Invalid taxpayer payload.",
    });
  });

  it("preserves the provider's not-invoiceable reason", () => {
    expect(
      mapTocinoError("process", {
        status: "not_invoiceable",
        invoice: {
          not_invoiceable_cause: "El ticket ya había sido facturado.",
        },
      })
    ).toEqual({
      code: "NOT_INVOICEABLE",
      category: "site",
      message: "El ticket ya había sido facturado.",
    });
  });

  it("preserves the merchant error message when an error code is present", () => {
    expect(
      mapTocinoError("process", {
        error_code: "MERCHANT_REJECTED",
        error_msg: "El portal rechazó la solicitud.",
      })
    ).toEqual({
      code: "MERCHANT_REJECTED",
      category: "site",
      message: "El portal rechazó la solicitud.",
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
      idempotencyKey: "process_upstream_webhook:ticket_id:nova_123",
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
        retryable: false,
      },
    });
  });
});
