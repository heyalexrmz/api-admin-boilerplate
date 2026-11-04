import { createHmac, timingSafeEqual } from "node:crypto";
import { publicTicketError } from "./public-errors";

const SUBMIT_PATH = "/api/external/tickets/";
const PUBLIC_FIELD_NAMES: Record<string, string> = {
  cfdi_use_code: "invoice_cfdi_use",
  filename: "file_name",
  fiscal_regimen_code: "invoice_fiscal_regimen",
};

type ErrorCategory =
  | "validation"
  | "auth"
  | "quota"
  | "site"
  | "connection"
  | "upstream"
  | "balance"
  | "unknown";

export type TocinoError = {
  code: string;
  category: ErrorCategory;
  message: string;
};

export type TocinoSubmitResult =
  | { ok: true; providerTicketId: string; raw: unknown }
  | { ok: false; error: TocinoError; raw?: unknown; status?: number; retryAfterSeconds?: number };

export type TocinoConfig = {
  baseUrl: string;
  apiKey: string;
  webhookHeader: string;
  webhookToken: string;
  webhookSecret: string;
  webhookSecretPrevious?: string;
  assetHosts: string[];
};

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getTocinoConfig(): TocinoConfig {
  return {
    baseUrl: optionalEnv("TOCINO_BASE_URL") ?? requiredEnv("UPSTREAM_BASE_URL"),
    apiKey: optionalEnv("TOCINO_API_KEY") ?? requiredEnv("UPSTREAM_API_KEY"),
    webhookHeader:
      optionalEnv("TOCINO_WEBHOOK_HEADER") ??
      optionalEnv("UPSTREAM_WEBHOOK_HEADER") ??
      "typeform-signature",
    webhookToken:
      optionalEnv("TOCINO_WEBHOOK_TOKEN") ??
      optionalEnv("UPSTREAM_WEBHOOK_TOKEN") ??
      "",
    webhookSecret:
      optionalEnv("TOCINO_WEBHOOK_SECRET") ??
      optionalEnv("UPSTREAM_WEBHOOK_SECRET") ??
      "",
    webhookSecretPrevious:
      optionalEnv("TOCINO_WEBHOOK_SECRET_PREVIOUS") ??
      optionalEnv("UPSTREAM_WEBHOOK_SECRET_PREVIOUS"),
    assetHosts: (
      optionalEnv("TOCINO_ASSET_HOSTS") ??
      optionalEnv("UPSTREAM_ASSET_HOSTS") ??
      ""
    )
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  };
}

function error(code: string, category: ErrorCategory, message: string): TocinoError {
  const normalized = publicTicketError({ code, type: category, message })!;
  return { code: normalized.code!, category: normalized.type as ErrorCategory, message: normalized.message! };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstDetailMessage(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const first = detail[0] as Record<string, unknown> | undefined;
    return stringValue(first?.msg) ?? stringValue(first?.message);
  }
  if (detail && typeof detail === "object") {
    const value = detail as Record<string, unknown>;
    return stringValue(value.msg) ?? stringValue(value.message) ?? stringValue(value.error);
  }
  return null;
}

function parseResponseBody(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// `nova_request_id` is the previous API's name; tickets accepted before the
// migration can still receive callbacks carrying it.
export function tocinoTicketId(raw: unknown): string | null {
  const payload = recordValue(raw);
  return stringValue(payload.ticket_id) ?? stringValue(payload.nova_request_id);
}

// The current API sends the cause at the root and `invoice` as an empty string.
function notInvoiceableCauseOf(raw: unknown): string | null {
  const payload = recordValue(raw);
  return stringValue(payload.not_invoiceable_cause) ??
    stringValue(recordValue(payload.invoice).not_invoiceable_cause);
}

function firstFieldError(value: Record<string, unknown>): string | null {
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages) && typeof messages[0] === "string") {
      return `${PUBLIC_FIELD_NAMES[field] ?? field}: ${messages[0]}`;
    }
  }
  return null;
}

export function mapTocinoError(
  phase: "submit" | "process",
  raw: unknown,
  status?: number
): TocinoError {
  // HTTP status takes precedence: `detail` also carries quota and server errors.
  if (phase === "submit") {
    if (status === 429) {
      return error("UPSTREAM_RATE_LIMITED", "quota", "El proveedor alcanzó su límite temporal de solicitudes.");
    }
    if (status === 401 || status === 403) {
      return error("UPSTREAM_AUTH_ERROR", "auth", "El servicio de facturación rechazó el acceso. Contacta a soporte.");
    }
    if (status !== undefined && status >= 500) {
      return error("UPSTREAM_UNAVAILABLE", "upstream", "El servicio de facturación no está disponible temporalmente.");
    }
    if (status === 408) {
      return error("UPSTREAM_UNAVAILABLE", "connection", "El servicio de facturación no respondió a tiempo.");
    }
    if (status !== undefined && status >= 200 && status < 300) {
      return error("UPSTREAM_INVALID_RESPONSE", "upstream", "No se pudo confirmar la recepción del ticket en el servicio de facturación. Contacta a soporte.");
    }
  }
  if (typeof raw === "string" && raw.trim()) {
    return error("UPSTREAM_REJECTED", "upstream", raw.trim());
  }
  const value = raw as Record<string, unknown> | null;
  if (phase === "submit") {
    if (value?.message === "__timeout__") {
      return error("UPSTREAM_UNAVAILABLE", "connection", "Upstream did not respond.");
    }
    if (value?.file) return error("FILE_REQUIRED", "validation", "Ticket image is required.");
    if (value?.tax_id) return error("TAX_ID_INVALID", "validation", "Tax id is invalid.");
    if (value?.message === "Insufficient balance") {
      return error("INSUFFICIENT_BALANCE", "balance", "Insufficient balance.");
    }
    const fieldError = firstFieldError(recordValue(value));
    if (fieldError) return error("UPSTREAM_VALIDATION", "validation", fieldError);
    const detailMessage = firstDetailMessage(value?.detail);
    if (detailMessage && (status === undefined || status === 400 || status === 422)) {
      return error("UPSTREAM_VALIDATION", "validation", detailMessage);
    }
    if (detailMessage) return error("UPSTREAM_REJECTED", "upstream", detailMessage);
    const message = stringValue(value?.message) ?? stringValue(value?.error);
    if (message) return error("UPSTREAM_REJECTED", "upstream", message);
    return error("UNKNOWN_UPSTREAM", "unknown", "Unrecognized upstream error.");
  }

  const notInvoiceableCause = notInvoiceableCauseOf(value);
  if (notInvoiceableCause || String(value?.status ?? "").toLowerCase() === "not_invoiceable") {
    return error(
      "NOT_INVOICEABLE",
      "site",
      notInvoiceableCause ?? stringValue(value?.error_msg) ?? "Este ticket no es facturable."
    );
  }
  if (value?.error_code) {
    return error(
      String(value.error_code),
      "site",
      value.error_msg
        ? String(value.error_msg)
        : "The merchant site could not process this ticket."
    );
  }
  if (value?.error_msg !== undefined) {
    return error("MERCHANT_ERROR", "site", String(value.error_msg));
  }
  return error("UNKNOWN_UPSTREAM", "unknown", "Unrecognized upstream failure.");
}

function retryAfterSeconds(header: string | null, raw: Record<string, unknown>): number | undefined {
  const message = firstDetailMessage(raw.detail) ?? stringValue(raw.message) ?? stringValue(raw.error);
  const bodyWait = message?.match(/Expected available in (\d+(?:\.\d+)?) seconds?\.?/i)?.[1];
  let headerWait: number | undefined;
  if (header && /^\d+$/.test(header.trim())) {
    headerWait = Number(header);
  } else if (header && /^[A-Za-z]{3},/.test(header.trim())) {
    headerWait = Math.max(0, (Date.parse(header) - Date.now()) / 1000);
  }
  const waits = [headerWait, bodyWait === undefined ? undefined : Number(bodyWait)]
    .filter((value): value is number =>
      value !== undefined && Number.isFinite(value) && value >= 0 &&
      Number.isFinite(new Date(Date.now() + value * 1000).getTime())
    );
  // Preserve the reported wait for diagnostics; it does not schedule a retry.
  return waits.length ? Math.ceil(Math.max(...waits)) : undefined;
}

export async function submitToTocino(input: {
  idempotencyKey: string;
  body: Record<string, unknown>;
  config?: TocinoConfig;
}): Promise<TocinoSubmitResult> {
  const config = input.config ?? getTocinoConfig();
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}${SUBMIT_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-API-KEY": config.apiKey,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = recordValue(parseResponseBody(await response.text()));
    const providerTicketId = stringValue(json.ticket_id);
    if (response.ok && providerTicketId) {
      return {
        ok: true,
        providerTicketId,
        raw: json,
      };
    }
    return {
      ok: false,
      error: mapTocinoError("submit", json, response.status),
      raw: json,
      status: response.status,
      ...(response.status === 429
        ? { retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after"), json) }
        : {}),
    };
  } catch {
    return { ok: false, error: mapTocinoError("submit", { message: "__timeout__" }) };
  }
}

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyHmac(secret: string, rawBody: string, timestamp: string, signature: string): boolean {
  if (!secret || !timestamp || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return tokenMatches(signature, expected);
}

export function verifyTocinoWebhook(input: {
  headers: Headers;
  rawBody: string;
  config?: TocinoConfig;
}): boolean {
  const config = input.config ?? getTocinoConfig();
  const headerName = config.webhookHeader.toLowerCase();
  const headerOk = tokenMatches(input.headers.get(headerName), config.webhookToken);
  const signature = input.headers.get("x-signature") ?? "";
  const timestamp = input.headers.get("x-timestamp") ?? "";
  const hmacOk =
    verifyHmac(config.webhookSecret, input.rawBody, timestamp, signature) ||
    verifyHmac(config.webhookSecretPrevious ?? "", input.rawBody, timestamp, signature);
  return headerOk || hmacOk;
}

export function classifyTocinoEvent(raw: unknown): "ticket.finalized" | "ticket.failed" | null {
  const value = raw as Record<string, unknown> | null;
  const status = String(value?.status ?? "").toLowerCase();
  const invoice = value?.invoice as Record<string, unknown> | undefined;
  if (["failed", "error", "not_invoiceable"].includes(status)) return "ticket.failed";
  if (notInvoiceableCauseOf(value) || value?.error_code || value?.error_msg) return "ticket.failed";
  if (["pending", "processing", "queued", "received", "invoicing"].includes(status)) return null;
  if (["finalized", "completed", "success"].includes(status)) return "ticket.finalized";
  if (invoice && Object.keys(invoice).length > 0) return "ticket.finalized";
  return null;
}

export function extractTocinoInvoice(raw: unknown) {
  const inv = recordValue(recordValue(raw).invoice);
  const xmlAttachment = inv.xml_attachment as Record<string, unknown> | undefined;
  const xmlData = xmlAttachment?.xml_data as Record<string, unknown> | undefined;
  const comp = xmlData?.Comprobante as Record<string, unknown> | undefined;
  const complementRaw = comp?.Complemento;
  const complement = (
    Array.isArray(complementRaw) ? complementRaw[0] : complementRaw
  ) as Record<string, unknown> | undefined;
  const tfdRaw = complement?.TimbreFiscalDigital;
  const tfd = (
    Array.isArray(tfdRaw) ? tfdRaw[0] : tfdRaw
  ) as Record<string, unknown> | undefined;
  const pdfAttachment = inv.pdf_attachment as Record<string, unknown> | undefined;
  return {
    issuerTaxpayer: inv.issuer_taxpayer ?? null,
    issuerRfc: inv.issuer_taxid ?? null,
    total: inv.invoice_total ?? comp?.Total ?? null,
    invoiceDate: inv.invoice_date ?? comp?.Fecha ?? null,
    satUuid: tfd?.UUID ?? null,
    series: comp?.Serie ?? null,
    folio: comp?.Folio ?? null,
    pdfUrl: inv.pdf ?? pdfAttachment?.file ?? null,
    xmlUrl: inv.xml ?? xmlAttachment?.file ?? null,
    xmlData: xmlAttachment?.xml_data ?? null,
  };
}

function xmlAttribute(xml: string, tag: string, attribute: string): string | null {
  const element = xml.match(new RegExp(`<(?:[\\w.-]+:)?${tag}\\b((?:[^>"']|"[^"]*"|'[^']*')*)>`))?.[1];
  const match = element?.match(new RegExp(`\\s${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return stringValue(match?.[1] ?? match?.[2]);
}

// The callback no longer carries these values; the signed CFDI is their only source.
export function parseCfdiIdentifiers(xml: Buffer) {
  const text = xml.toString("utf8");
  return {
    satUuid: xmlAttribute(text, "TimbreFiscalDigital", "UUID"),
    series: xmlAttribute(text, "Comprobante", "Serie"),
    folio: xmlAttribute(text, "Comprobante", "Folio"),
  };
}

export async function downloadTocinoAsset(
  url: string,
  config: TocinoConfig = getTocinoConfig()
): Promise<{ buffer: Buffer; contentType: string }> {
  const parsed = new URL(url);
  if (!config.assetHosts.includes(parsed.hostname)) {
    throw new Error(`Tocino asset host is not allowed: ${parsed.hostname}`);
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Tocino asset download failed: ${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}
