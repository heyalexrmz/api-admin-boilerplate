import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { requestLog } from "@/lib/db/schema";
import { authenticateApiKey } from "@/lib/api-auth";
import type { HttpMethod, RequestHeader } from "@/app/lib/definitions";
import {
  capText,
  redactRequestBody,
  serializeSafeHeaders,
} from "@/lib/log-redaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/ping";
// Cap stored bodies so a huge payload can't blow up the request_log row.
const MAX_BODY_BYTES = 8 * 1024;

type ProcessResult = { status: number; payload: unknown };

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

async function readBodyWithLimit(
  req: NextRequest
): Promise<{ body: string | null } | { tooLarge: true }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { tooLarge: true };
  }

  if (!req.body) return { body: null };

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return { tooLarge: true };
    }
    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();
  return { body: body || null };
}

async function logRequest(input: {
  organizationId: string;
  apiKeyId: string;
  requestId: string;
  method: HttpMethod;
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
    path: PATH,
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

function processRequest(
  method: HttpMethod,
  simulateError: boolean,
  rawBody: string | null,
  key: { name: string; scopes: string[] },
  organization: { name: string; slug: string },
  requestId: string
): ProcessResult {
  const base = {
    ok: true,
    requestId,
    method,
    path: PATH,
    key: { name: key.name, scopes: key.scopes },
    organization: { name: organization.name, slug: organization.slug },
    timestamp: new Date().toISOString(),
  };

  if (simulateError) {
    throw new Error("Simulated server error (triggered by ?error=true).");
  }

  if (method === "GET") {
    return { status: 200, payload: { ...base, message: "pong" } };
  }

  // POST
  if (!rawBody) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: "missing_body",
          message: "POST requests must include a JSON body.",
          requestId,
        },
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return {
      status: 400,
      payload: {
        ok: false,
        error: {
          code: "invalid_json",
          message: "Request body is not valid JSON.",
          requestId,
        },
      },
    };
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed as { simulate_error?: unknown }).simulate_error === true
  ) {
    throw new Error("Simulated server error (triggered by body.simulate_error = true).");
  }

  return { status: 200, payload: { ...base, message: "pong", echoed: parsed } };
}

async function handle(req: NextRequest, method: HttpMethod): Promise<Response> {
  const startedAt = Date.now();
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const requestHeaders = serializeSafeHeaders(req.headers);
  const simulateError = req.nextUrl.searchParams.get("error") === "true";

  const auth = await authenticateApiKey(req);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: { code: auth.code, message: auth.message, requestId } },
      { status: auth.status, headers: { "x-request-id": requestId } }
    );
  }

  const { key, organization } = auth;
  let rawBody: string | null = null;
  let loggableRequestBody: string | null = null;
  let bodyTooLarge = false;

  if (method === "POST") {
    const readResult = await readBodyWithLimit(req);
    if ("tooLarge" in readResult) {
      bodyTooLarge = true;
    } else {
      rawBody = readResult.body;
      loggableRequestBody = rawBody ? redactRequestBody(rawBody, MAX_BODY_BYTES) : null;
    }
  }

  let status = 200;
  let payload: unknown;
  if (bodyTooLarge) {
    status = 413;
    payload = {
      ok: false,
      error: {
        code: "payload_too_large",
        message: "Request body exceeds the 8 KiB limit.",
        requestId,
      },
    };
  } else {
    try {
      const result = processRequest(
        method,
        simulateError,
        rawBody,
        key,
        organization,
        requestId
      );
      status = result.status;
      payload = result.payload;
    } catch (error) {
      status = 500;
      payload = {
        ok: false,
        error: {
          code: "internal_error",
          message: error instanceof Error ? error.message : "Unexpected error.",
          requestId,
        },
      };
    }
  }

  const latencyMs = Date.now() - startedAt;
  const responseHeaders: RequestHeader[] = [
    { name: "content-type", value: "application/json" },
    { name: "x-request-id", value: requestId },
  ];

  // Best-effort logging: a logging failure must not break the API response.
  try {
    await logRequest({
      organizationId: organization.id,
      apiKeyId: key.id,
      requestId,
      method,
      status,
      latencyMs,
      ip,
      userAgent,
      requestHeaders,
      requestBody: loggableRequestBody,
      responseHeaders,
      // Only persist response bodies for errors to keep rows lean; 2xx bodies
      // are reconstructed from the request and not stored.
      responseBody: status >= 400 ? capText(JSON.stringify(payload), MAX_BODY_BYTES) : null,
    });
  } catch (logError) {
    console.error("[api/ping] failed to persist request log", logError);
  }

  return Response.json(payload, {
    status,
    headers: { "x-request-id": requestId },
  });
}

export async function GET(req: NextRequest) {
  return handle(req, "GET");
}

export async function POST(req: NextRequest) {
  return handle(req, "POST");
}
