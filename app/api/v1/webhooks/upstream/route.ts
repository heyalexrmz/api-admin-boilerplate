import type { NextRequest } from "next/server";

import { objectResponse, ApiError, errorResponse } from "@/lib/api-contracts";
import { enqueueTocinoWebhookEvent } from "@/lib/facturador/core";
import {
  clientIp,
  persistRequestLog,
  safeRequestHeaders,
  safeResponseHeaders,
} from "@/lib/request-logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/v1/webhooks/upstream";

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = req.headers.get("x-request-id") ?? "req_upstream_webhook";
  const rawBody = await req.text();
  let status = 200;
  let response: Response;

  try {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new ApiError({
        status: 400,
        code: "invalid_json",
        type: "validation_error",
        message: "Webhook payload is not valid JSON.",
      });
    }

    const result = await enqueueTocinoWebhookEvent(payload);
    response = objectResponse("upstream_webhook", result, requestId);
  } catch (error) {
    response = errorResponse(
      error instanceof ApiError
        ? error
        : new ApiError({
            status: 500,
            code: "internal_error",
            type: "internal_error",
            message: "Could not process upstream webhook.",
          }),
      requestId
    );
  }

  status = response.status;
  response.headers.set("x-request-id", requestId);
  try {
    await persistRequestLog({
      organizationId: null,
      apiKeyId: null,
      requestId,
      method: "POST",
      path: PATH,
      status,
      latencyMs: Date.now() - startedAt,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent") ?? "unknown",
      requestHeaders: safeRequestHeaders(req),
      requestBody: "[upstream webhook body omitted]",
      responseHeaders: safeResponseHeaders(response),
      responseBody: status >= 400 ? await response.clone().text() : null,
    });
  } catch (logError) {
    console.error("[api/webhooks/upstream] failed to persist request log", logError);
  }

  return response;
}
