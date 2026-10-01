export type PublicTicketError = {
  code: string | null;
  type: string | null;
  message: string | null;
};

const PRIVATE_PROVIDER_NAME = /tocino|(?:^|\W|_)nova(?:$|\W|_)/i;

export function publicErrorMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s<>"']+/gi, "[enlace interno omitido]")
    .replace(/nova_request_id/gi, "identificador de procesamiento")
    .replace(/tocino/gi, "servicio de facturación")
    .replace(/\bnova(?:[_-][a-z0-9]+)*\b/gi, "servicio de facturación");
}

export function publicTicketError(error: PublicTicketError | null): PublicTicketError | null {
  if (!error || (!error.code && !error.message)) return null;
  if (error.code === "UPSTREAM_RATE_LIMITED" || /^Request was throttled\./i.test(error.message ?? "")) {
    return {
      code: "UPSTREAM_RATE_LIMITED",
      type: "quota",
      message: "Se alcanzó el límite temporal de solicitudes del servicio de facturación.",
    };
  }
  const privateCode = error.code && PRIVATE_PROVIDER_NAME.test(error.code);
  return {
    code: privateCode ? "UNKNOWN_UPSTREAM" : error.code,
    type: privateCode || (error.type && PRIVATE_PROVIDER_NAME.test(error.type)) ? "upstream" : error.type,
    message: error.message ? publicErrorMessage(error.message) : null,
  };
}
