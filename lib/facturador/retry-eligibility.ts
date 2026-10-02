export function canRetryTicketSubmission(ticket: {
  status: string;
  providerRequestId: string | null;
  invoiceId: string | null;
  upstreamRaw: unknown;
}): boolean {
  const failure = ticket.upstreamRaw;
  return ticket.status === "failed" &&
    ticket.providerRequestId === null &&
    ticket.invoiceId === null &&
    typeof failure === "object" && failure !== null &&
    "phase" in failure && failure.phase === "submit";
}
