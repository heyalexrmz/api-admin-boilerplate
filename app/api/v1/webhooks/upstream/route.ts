import type { NextRequest } from "next/server";

import { randomUUID } from "node:crypto";
import { acceptRouterWebhook } from "@/lib/webhook-router/ingress";
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
  const requestId = randomUUID();
  const response = await acceptRouterWebhook(req);
  const status = response.status;
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
