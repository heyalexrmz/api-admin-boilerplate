type TicketStatus = "received" | "queued" | "pending" | "processing" | "finalized" | "failed" | "cancelled";

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
