"use server";

import { desc, eq } from "drizzle-orm";

import { apiKey, requestLog } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { requireOrganizationManager } from "@/app/lib/auth";
import type { HttpMethod, RequestHeader, RequestLog } from "@/app/lib/definitions";

const MAX_LOGS = 200;

export async function listRequestLogs(): Promise<RequestLog[]> {
  const { organization } = await requireOrganizationManager();

  const rows = await db
    .select({
      id: requestLog.id,
      requestId: requestLog.requestId,
      timestamp: requestLog.timestamp,
      method: requestLog.method,
      path: requestLog.path,
      status: requestLog.status,
      latencyMs: requestLog.latencyMs,
      ip: requestLog.ip,
      userAgent: requestLog.userAgent,
      requestHeaders: requestLog.requestHeaders,
      requestBody: requestLog.requestBody,
      responseHeaders: requestLog.responseHeaders,
      responseBody: requestLog.responseBody,
      keyName: apiKey.name,
    })
    .from(requestLog)
    .leftJoin(apiKey, eq(apiKey.id, requestLog.apiKeyId))
    .where(eq(requestLog.organizationId, organization.id))
    .orderBy(desc(requestLog.timestamp))
    .limit(MAX_LOGS);

  return rows.map((row) => ({
    id: row.id,
    requestId: row.requestId,
    timestamp: row.timestamp.toISOString(),
    method: row.method as HttpMethod,
    path: row.path,
    status: row.status,
    latencyMs: row.latencyMs,
    ip: row.ip,
    userAgent: row.userAgent,
    requestHeaders: (row.requestHeaders as RequestHeader[]) ?? [],
    requestBody: row.requestBody,
    responseHeaders: (row.responseHeaders as RequestHeader[]) ?? [],
    responseBody: row.responseBody,
    keyName: row.keyName ?? "Unknown",
  }));
}
