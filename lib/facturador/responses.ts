type TicketStatus = "received" | "queued" | "pending" | "processing" | "finalized" | "failed" | "cancelled";
type InvoiceStatus = "pending" | "finalized" | "failed";

type WebhookDocument = {
  id: string;
  kind: string;
  content_type: string;
  bytes: number | null;
  url: string;
  created_at: string;
};

export function ticketWebhookRequestMetadata(input: {
  ticketId: string;
  idempotencyKey?: string | null;
  livemode: boolean;
}) {
  return {
    id: input.ticketId,
    idempotencyKey: input.idempotencyKey ?? null,
    livemode: input.livemode,
  };
}

export function ticketProviderResponseView(input: {
  ticketId: string;
  status: TicketStatus;
  livemode: boolean;
  error?: { code: string | null; type: string | null; message: string | null } | null;
}) {
  return {
    object: "ticket_response",
    ticket_id: input.ticketId,
    status: input.status,
    livemode: input.livemode,
    message:
      input.status === "failed"
        ? "Ticket submission failed."
        : "Ticket submitted for processing.",
    error: input.error ?? null,
  };
}

export function ticketFinalResponseView(input: {
  ticketId: string;
  status: TicketStatus;
  livemode: boolean;
  invoiceId: string | null;
  invoiceUuid: string | null;
  error: { code: string | null; type: string | null; message: string | null } | null;
}) {
  return {
    object: "ticket_final_response",
    ticket_id: input.ticketId,
    status: input.status,
    livemode: input.livemode,
    invoice: input.invoiceId
      ? {
          id: input.invoiceId,
          uuid: input.invoiceUuid,
        }
      : null,
    error: input.error,
  };
}

export function invoiceFinalizedWebhookPayload(input: {
  ticket: {
    id: string;
    livemode: boolean;
  };
  invoice: {
    id: string;
    status: InvoiceStatus;
    uuid: string | null;
    series: string | null;
    folio: string | null;
    issuerTaxpayer: string | null;
    issuerRfc: string | null;
    total: string | null;
    invoiceDate: string | null;
  };
  documents: WebhookDocument[];
}) {
  return {
    object: "invoice",
    id: input.invoice.id,
    status: input.invoice.status,
    ticket_id: input.ticket.id,
    livemode: input.ticket.livemode,
    uuid: input.invoice.uuid,
    series: input.invoice.series,
    folio: input.invoice.folio,
    issuer_taxpayer: input.invoice.issuerTaxpayer,
    issuer_rfc: input.invoice.issuerRfc,
    total: input.invoice.total,
    invoice_date: input.invoice.invoiceDate,
    documents: input.documents,
  };
}

export function invoiceFailedWebhookPayload(input: {
  ticket: {
    id: string;
    livemode: boolean;
  };
  error: { code: string | null; type: string | null; message: string | null };
}) {
  return {
    object: "invoice",
    status: "failed",
    ticket_id: input.ticket.id,
    livemode: input.ticket.livemode,
    error: input.error,
  };
}
