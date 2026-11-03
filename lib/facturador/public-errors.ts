export type PublicTicketError = {
  code: string | null;
  type: string | null;
  message: string | null;
};

export type PublicTicketErrorView = PublicTicketError & {
  /**
   * True when sending the same purchase again, as a new ticket, can succeed
   * without changing any data. False when the data must be corrected, the
   * ticket can never be invoiced, or the first attempt may already have been
   * processed and must be checked before sending another one.
   */
  retryable: boolean;
};

const PRIVATE_PROVIDER_NAME = /tocino|(?:^|\W|_)nova(?:$|\W|_)/i;

type CatalogEntry = {
  /** Fixed end-user message. When omitted, the sanitized original reason is kept. */
  message?: string;
  retryable: boolean;
};

// Stable public codes. Messages are written for end users: Spanish, no service
// or vendor names, no internal identifiers.
const CATALOG: Record<string, CatalogEntry> = {
  SERVICE_UNAVAILABLE: {
    message: "El servicio de facturación no está disponible en este momento. Intenta de nuevo más tarde.",
    retryable: true,
  },
  UPSTREAM_RATE_LIMITED: {
    message: "El servicio de facturación alcanzó su límite temporal de solicitudes. Intenta de nuevo en unos minutos.",
    retryable: true,
  },
  UPSTREAM_UNAVAILABLE: {
    message: "El servicio de facturación no está disponible temporalmente. Intenta de nuevo más tarde.",
    retryable: true,
  },
  PROVIDER_TIMEOUT: {
    message: "No recibimos el resultado de la facturación a tiempo. Revisa si la factura se emitió antes de enviar el ticket otra vez.",
    retryable: false,
  },
  UPSTREAM_AUTH_ERROR: {
    message: "No fue posible procesar el ticket por un problema de configuración del servicio. Contacta a soporte.",
    retryable: false,
  },
  UPSTREAM_INVALID_RESPONSE: {
    message: "No pudimos confirmar si el ticket se recibió. Revisa su estado antes de enviarlo otra vez.",
    retryable: false,
  },
  INSUFFICIENT_BALANCE: {
    message: "No fue posible procesar el ticket por un problema de configuración del servicio. Contacta a soporte.",
    retryable: false,
  },
  UNKNOWN_UPSTREAM: { retryable: false },
  UPSTREAM_REJECTED: { retryable: false },
  UPSTREAM_VALIDATION: { retryable: false },
  FILE_REQUIRED: {
    message: "Falta la imagen del ticket o no se pudo leer. Envía una foto clara del ticket.",
    retryable: false,
  },
  TAX_ID_INVALID: {
    message: "El RFC no es válido. Revisa los datos fiscales.",
    retryable: false,
  },
  NOT_INVOICEABLE: { retryable: false },
  MERCHANT_ERROR: { retryable: false },
  IMAGE_MISSING: {
    message: "No encontramos la imagen del ticket. Envía el ticket de nuevo.",
    retryable: true,
  },
  INTAKE_FAILED: {
    message: "No pudimos registrar el ticket. Envíalo de nuevo.",
    retryable: true,
  },
  TEST_SCENARIO_FAILED: { retryable: false },
};

// A connection failure or timeout during submission leaves it unknown whether
// the service received the ticket, so it must not be resent blindly.
const AMBIGUOUS_CONNECTION_FAILURE: CatalogEntry = {
  message: "El servicio de facturación no respondió a tiempo. Revisa el estado del ticket antes de enviarlo otra vez.",
  retryable: false,
};

export function publicErrorMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s<>"']+/gi, "[enlace interno omitido]")
    .replace(/nova_request_id/gi, "identificador de procesamiento")
    .replace(/tocino/gi, "servicio de facturación")
    .replace(/\bnova(?:[_-][a-z0-9]+)*\b/gi, "servicio de facturación")
    .replace(/\btimbre\b/gi, "servicio de facturación");
}

function catalogEntry(code: string | null, type: string | null): CatalogEntry | null {
  if (code === "UPSTREAM_UNAVAILABLE" && type === "connection") return AMBIGUOUS_CONNECTION_FAILURE;
  return code ? CATALOG[code] ?? null : null;
}

export function isRetryableTicketError(code: string | null, type: string | null): boolean {
  return catalogEntry(code, type)?.retryable ?? false;
}

export function publicTicketError(error: PublicTicketError | null): PublicTicketErrorView | null {
  if (!error || (!error.code && !error.message)) return null;
  if (error.code === "UPSTREAM_RATE_LIMITED" || /^Request was throttled\./i.test(error.message ?? "")) {
    const entry = CATALOG.UPSTREAM_RATE_LIMITED!;
    return { code: "UPSTREAM_RATE_LIMITED", type: "quota", message: entry.message!, retryable: entry.retryable };
  }
  const privateCode = error.code && PRIVATE_PROVIDER_NAME.test(error.code);
  const code = privateCode ? "UNKNOWN_UPSTREAM" : error.code;
  const type =
    privateCode || (error.type && PRIVATE_PROVIDER_NAME.test(error.type)) ? "upstream" : error.type;
  const entry = catalogEntry(code, type);
  return {
    code,
    type,
    message: entry?.message ?? (error.message ? publicErrorMessage(error.message) : null),
    retryable: entry?.retryable ?? false,
  };
}
