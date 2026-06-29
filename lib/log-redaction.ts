import type { RequestHeader } from "@/app/lib/definitions";

const SAFE_HEADER_NAMES = new Set([
  "accept",
  "content-length",
  "content-type",
  "host",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  "x-request-id",
]);

const SENSITIVE_FIELD_PATTERN =
  /(?:api[_-]?key|authorization|credential|password|secret|session|token)/i;

function redactJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key) ? "[redacted]" : redactJson(child),
    ])
  );
}

export function serializeSafeHeaders(headers: Headers): RequestHeader[] {
  const out: RequestHeader[] = [];
  headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    out.push({
      name,
      value: SAFE_HEADER_NAMES.has(lower) ? value : "[redacted]",
    });
  });
  return out;
}

export function capText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...[truncated]` : text;
}

export function redactRequestBody(text: string, max: number): string {
  try {
    return capText(JSON.stringify(redactJson(JSON.parse(text))), max);
  } catch {
    return "[unparseable body omitted]";
  }
}
