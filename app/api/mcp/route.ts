import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { GET as listDeliveries } from "@/app/api/v1/deliveries/route";
import { GET as listEventTypes } from "@/app/api/v1/destinations/event-types/route";
import { GET as listDestinations } from "@/app/api/v1/destinations/route";
import { GET as getStats } from "@/app/api/v1/stats/route";
import { GET as getStatus } from "@/app/api/v1/status/route";
import { GET as getTicket } from "@/app/api/v1/tickets/[id]/route";
import { GET as listTickets, POST as createTicket } from "@/app/api/v1/tickets/route";
import { GET as getUsage } from "@/app/api/v1/usage/route";
import { createDelegatedApiRequest, type ApiRouteIdentity } from "@/lib/api-route-handler";
import { authenticateMcp } from "@/lib/mcp-auth";
import { mcpResourceUrl } from "@/lib/mcp-config";
import { ticketStatus } from "@/lib/db/schema/facturador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RestHandler = (request: NextRequest) => Promise<Response>;
const readOnly = { readOnlyHint: true, openWorldHint: false };

function createServer(request: NextRequest, identity: ApiRouteIdentity) {
  const server = new McpServer({ name: "taxo-timbre", version: "1.0.0" });

  async function call(
    handler: RestHandler,
    path: string,
    signal: AbortSignal,
    options?: {
      mode?: ApiRouteIdentity["key"]["mode"];
      json?: { idempotencyKey: string; body: Record<string, unknown> };
    }
  ) {
    const input = options?.json;
    const delegatedIdentity = options?.mode
      ? { ...identity, key: { ...identity.key, mode: options.mode } }
      : identity;
    const headers = new Headers();
    for (const name of ["x-request-id", "user-agent", "x-forwarded-for", "x-real-ip"]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (input) {
      headers.set("content-type", "application/json");
      headers.set("idempotency-key", input.idempotencyKey);
    }

    const response = await handler(createDelegatedApiRequest(new URL(path, request.nextUrl.origin), {
      method: input ? "POST" : "GET",
      headers,
      signal,
      body: input ? JSON.stringify(input.body) : undefined,
    }, delegatedIdentity));

    const retryAfter = response.headers.get("retry-after");
    const result = {
      http_status: response.status,
      ...(retryAfter ? { retry_after_seconds: Number(retryAfter) } : {}),
      ...(response.headers.get("idempotent-replayed") === "true" ? { idempotent_replayed: true } : {}),
      response: await response.json(),
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: result,
      isError: !response.ok,
    };
  }

  server.registerTool("list_tickets", {
    description: "List recent tickets for the organization, newest first. Requires read scope.",
    annotations: readOnly,
    inputSchema: z.object({
      limit: z.number().int().min(1).max(200).optional(),
      status: z.enum(ticketStatus.enumValues).optional(),
    }),
  }, ({ limit, status }, { signal }) => {
    const query = new URLSearchParams();
    if (limit !== undefined) query.set("limit", String(limit));
    if (status) query.set("status", status);
    return call(listTickets, `/api/v1/tickets?${query}`, signal);
  });

  server.registerTool("get_ticket", {
    description: "Get a ticket by ID, with its result and temporary document URLs. Requires read scope.",
    annotations: readOnly,
    inputSchema: z.object({ ticket_id: z.uuid() }),
  }, ({ ticket_id }, { signal }) =>
    call((req) => getTicket(req, { params: Promise.resolve({ id: ticket_id }) }),
      `/api/v1/tickets/${ticket_id}`, signal));

  server.registerTool("create_ticket", {
    description: "Submit a receipt for asynchronous invoicing. A new live ticket costs one credit. Reuse the same idempotency key and body after a timeout or retryable API error. Requires write scope.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: z.object({
      idempotency_key: z.string().trim().regex(/^[!-~]+$/).describe("Printable ASCII identifier unique to this submission."),
      mode: z.enum(["test", "live"]).describe("Use test for simulations or live to submit for invoicing and spend a credit."),
      tax_id: z.string().trim().min(1).describe("RFC of the taxpayer receiving the invoice."),
      taxpayer: z.string().optional().describe("Legal name or full name."),
      taxpayer_name: z.string().optional(),
      taxpayer_last_name: z.string().optional(),
      taxpayer_second_last_name: z.string().optional(),
      postal_code: z.string().optional(),
      invoice_fiscal_regimen: z.string().optional(),
      invoice_cfdi_use: z.string().optional(),
      fiscal_regimen_code: z.string().optional(),
      cfdi_use_code: z.string().optional(),
      street_address_1: z.string().optional(),
      street_address_2: z.string().optional(),
      ext_num: z.string().optional(),
      int_num: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      file: z.string().min(1).describe("JPEG or PNG in base64. Maximum decoded size is 10 MiB."),
      file_name: z.string().optional(),
      file_content_type: z.enum(["image/jpeg", "image/png"]).optional(),
      csf_pdf: z.string().optional().describe("Optional tax status certificate in PDF, encoded as base64."),
      csf_pdf_file_name: z.string().optional(),
      csf_pdf_content_type: z.literal("application/pdf").optional(),
      test_scenario: z.enum(["success", "failure"]).optional().describe("Simulated outcome in test mode."),
    }),
  }, ({ idempotency_key, mode, ...body }, { signal }) =>
    call(createTicket, "/api/v1/tickets", signal, { mode, json: { idempotencyKey: idempotency_key, body } }));

  server.registerTool("get_stats", {
    description: "Get organization ticket counts and invoicing outcome rates. Requires read scope.",
    annotations: readOnly,
    inputSchema: z.object({ days: z.number().int().min(1).max(365).optional() }),
  }, ({ days }, { signal }) =>
    call(getStats, `/api/v1/stats${days === undefined ? "" : `?days=${days}`}`, signal));

  server.registerTool("get_service_status", {
    description: "Get service availability for live or test mode. Defaults to live. Requires read scope.",
    annotations: readOnly,
    inputSchema: z.object({ mode: z.enum(["test", "live"]).optional() }),
  }, ({ mode }, { signal }) =>
    call(getStatus, "/api/v1/status", signal, { mode }));

  const reads = [
    ["get_usage", "Get current monthly usage, plan and available credits. Requires billing scope.", "/api/v1/usage", getUsage],
    ["list_webhook_destinations", "List the organization's webhook destinations. Requires read scope.", "/api/v1/destinations", listDestinations],
    ["list_webhook_event_types", "List supported webhook subscription types. Requires read scope.", "/api/v1/destinations/event-types", listEventTypes],
    ["list_webhook_deliveries", "List up to 200 recent webhook delivery summaries. Requires read scope.", "/api/v1/deliveries", listDeliveries],
  ] as const;

  for (const [name, description, path, handler] of reads) {
    server.registerTool(name, { description, annotations: readOnly },
      ({ signal }) => call(handler, path, signal));
  }

  return server;
}

export async function POST(request: NextRequest) {
  const resource = new URL(mcpResourceUrl());
  if (request.headers.get("host") !== resource.host) {
    return new Response(null, { status: 404 });
  }
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== resource.origin) {
    return new Response(null, { status: 403 });
  }

  const identity = await authenticateMcp(request);
  if (identity instanceof Response) return identity;

  const server = createServer(request, identity);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    await server.close();
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export const DELETE = GET;
