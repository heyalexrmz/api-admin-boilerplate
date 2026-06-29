import "server-only";

import type { NextRequest } from "next/server";

import type { HttpMethod, RequestHeader } from "@/app/lib/definitions";
import { db } from "@/lib/db";
import { requestLog } from "@/lib/db/schema";
import { capText, redactRequestBody, serializeSafeHeaders } from "@/lib/log-redaction";

export const MAX_LOG_BODY_BYTES = 8 * 1024;

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function readTextBodyWithLimit(
  req: NextRequest,
  maxBytes = MAX_LOG_BODY_BYTES
): Promise<{ body: string | null } | { tooLarge: true }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) return { tooLarge: true };
  if (!req.body) return { body: null };

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { tooLarge: true };
    }
    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();
  return { body: body || null };
}

export function loggableJsonBody(rawBody: string | null): string | null {
  return rawBody ? redactRequestBody(rawBody, MAX_LOG_BODY_BYTES) : null;
}

export async function persistRequestLog(input: {
  organizationId: string | null;
  apiKeyId: string | null;
  requestId: string;
  method: HttpMethod;
  path: string;
  status: number;
  latencyMs: number;
  ip: string;
  userAgent: string;
  requestHeaders: RequestHeader[];
  requestBody: string | null;
  responseHeaders: RequestHeader[];
  responseBody: string | null;
}): Promise<void> {
  await db.insert(requestLog).values({
    organizationId: input.organizationId,
    apiKeyId: input.apiKeyId,
    requestId: input.requestId,
    method: input.method,
    path: input.path,
    status: input.status,
    latencyMs: input.latencyMs,
    ip: input.ip,
    userAgent: input.userAgent,
    requestHeaders: input.requestHeaders,
    requestBody: input.requestBody,
    responseHeaders: input.responseHeaders,
    responseBody: input.responseBody,
  });
}

export function safeRequestHeaders(req: NextRequest): RequestHeader[] {
  return serializeSafeHeaders(req.headers);
}

export function safeResponseHeaders(response: Response): RequestHeader[] {
  return Array.from(response.headers.entries()).map(([name, value]) => ({
    name,
    value,
  }));
}

export async function errorResponseBodyForLog(response: Response): Promise<string | null> {
  if (response.status < 400) return null;
  try {
    return capText(await response.clone().text(), MAX_LOG_BODY_BYTES);
  } catch {
    return null;
  }
}
