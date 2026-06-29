import "server-only";

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import type { HttpMethod } from "@/app/lib/definitions";
import { ApiError, errorResponse, internalErrorResponse } from "@/lib/api-contracts";
import { authenticateApiKey, type ApiKeyAuthSuccess } from "@/lib/api-auth";
import {
  clientIp,
  errorResponseBodyForLog,
  persistRequestLog,
  safeRequestHeaders,
  safeResponseHeaders,
} from "@/lib/request-logging";

export type ApiScope = "read" | "write" | "admin" | "billing";

export type ApiRouteContext = ApiKeyAuthSuccess & {
  requestId: string;
  mode: "live" | "test";
  livemode: boolean;
};

type HandlerParams = {
  req: NextRequest;
  method: HttpMethod;
  path: string;
  requiredScope?: ApiScope;
  requestBodyForLog?: string | null;
  handler: (context: ApiRouteContext) => Promise<Response>;
};

function hasScope(scopes: string[], requiredScope?: ApiScope): boolean {
  if (!requiredScope) return true;
  if (scopes.includes("access")) return true;
  if (scopes.includes("admin")) return true;
  return scopes.includes(requiredScope);
}

export async function handleApiRoute({
  req,
  method,
  path,
  requiredScope,
  requestBodyForLog = null,
  handler,
}: HandlerParams): Promise<Response> {
  const startedAt = Date.now();
  const requestId = req.headers.get("x-request-id") ?? `req_${randomUUID()}`;
  const requestHeaders = safeRequestHeaders(req);
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  let organizationId: string | null = null;
  let apiKeyId: string | null = null;
  let response: Response;

  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) {
      response = errorResponse(
        new ApiError({
          status: auth.status,
          code: auth.code,
          type: "authentication_error",
          message: auth.message,
        }),
        requestId
      );
    } else if (!hasScope(auth.key.scopes, requiredScope)) {
      organizationId = auth.organization.id;
      apiKeyId = auth.key.id;
      response = errorResponse(
        new ApiError({
          status: 403,
          code: "insufficient_scope",
          type: "authorization_error",
          message: `This endpoint requires the ${requiredScope} scope.`,
        }),
        requestId
      );
    } else {
      organizationId = auth.organization.id;
      apiKeyId = auth.key.id;
      response = await handler({
        ...auth,
        requestId,
        mode: auth.key.mode,
        livemode: auth.key.mode === "live",
      });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      response = errorResponse(error, requestId);
    } else {
      console.error(`[api] ${method} ${path} failed`, error);
      response = internalErrorResponse(requestId);
    }
  }

  response.headers.set("x-request-id", requestId);

  try {
    await persistRequestLog({
      organizationId,
      apiKeyId,
      requestId,
      method,
      path,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      ip,
      userAgent,
      requestHeaders,
      requestBody: requestBodyForLog,
      responseHeaders: safeResponseHeaders(response),
      responseBody: await errorResponseBodyForLog(response),
    });
  } catch (logError) {
    console.error(`[api] failed to persist request log for ${path}`, logError);
  }

  return response;
}
