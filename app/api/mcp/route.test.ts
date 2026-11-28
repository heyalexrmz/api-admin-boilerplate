import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { DELETE, GET, POST } from "./route";

const { listTickets, createTicketFromJson } = vi.hoisted(() => ({
  listTickets: vi.fn(),
  createTicketFromJson: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api-auth", () => ({
  authenticateApiKey: () => { throw new Error("MCP must delegate the OAuth identity"); },
}));
vi.mock("@/lib/mcp-config", () => ({
  mcpResourceUrl: () => "https://api.example.com/api/mcp",
}));
vi.mock("@/lib/mcp-auth", () => ({
  authenticateMcp: async (request: Request) => {
    const key = request.headers.get("Authorization");
    if (key !== "Bearer test-read" && key !== "Bearer test-write") {
      return new Response(null, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
    }
    return {
      ok: true,
      key: { id: null, mode: "live", scopes: [key === "Bearer test-read" ? "read" : "write"] },
      organization: { id: "org-from-key" },
    };
  },
}));
vi.mock("@/lib/request-logging", () => ({
  clientIp: () => "local",
  safeRequestHeaders: () => [],
  safeResponseHeaders: () => [],
  errorResponseBodyForLog: async () => null,
  persistRequestLog: async () => {},
}));
vi.mock("@/lib/facturador/core", () => ({ listTickets, createTicketFromJson }));
vi.mock("@/lib/facturador/destinations", () => ({}));
vi.mock("@/lib/facturador/service-health", () => ({}));
vi.mock("@/lib/facturador/health-watchdog", () => ({ triggerHealthWatchdog: () => {} }));

const url = new URL("https://api.example.com/api/mcp");
const createArgs = { mode: "test", idempotency_key: "ticket-001", tax_id: "EKU9003173C9", file: "base64" };

async function withClient(key: string, run: (client: Client) => Promise<void>) {
  const client = new Client({ name: "taxo-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${key}`, "X-Request-Id": "req_mcp_test" } },
    fetch: async (input, init) => {
      const raw = new Request(input, init);
      raw.headers.set("host", url.host);
      const request = new NextRequest(raw);
      return request.method === "POST" ? POST(request) : GET();
    },
  });

  try {
    await client.connect(transport);
    await run(client);
  } finally {
    await client.close();
  }
}

beforeEach(() => {
  vi.resetAllMocks();
});

test("requires a valid key and rejects a cross-origin request", async () => {
  const unauthenticated = await POST(new NextRequest(url, { method: "POST", headers: { host: url.host } }));
  expect(unauthenticated.status).toBe(401);
  expect(unauthenticated.headers.get("www-authenticate")).toContain("Bearer");

  const crossOrigin = await POST(new NextRequest(url, {
    method: "POST",
    headers: { host: url.host, Origin: "https://other.example.com", Authorization: "Bearer test-read" },
  }));
  expect(crossOrigin.status).toBe(403);
  expect(GET().status).toBe(405);
  expect(DELETE().status).toBe(405);
});

test("negotiates the protocol and scopes calls to the key's organization and permissions", async () => {
  listTickets.mockResolvedValue([{ id: "ticket" }]);
  await withClient("test-read", async (client) => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(9);

    const result = await client.callTool({ name: "list_tickets", arguments: { limit: 5, status: "finalized" } });
    expect(result.structuredContent).toMatchObject({
      http_status: 200,
      response: { data: [{ id: "ticket" }], request_id: "req_mcp_test" },
    });
    const forbidden = await client.callTool({ name: "create_ticket", arguments: createArgs });
    expect(forbidden).toMatchObject({
      isError: true,
      structuredContent: { http_status: 403, response: { error: { code: "insufficient_scope" } } },
    });
  });

  expect(listTickets).toHaveBeenCalledWith({ organizationId: "org-from-key", limit: 5, status: "finalized" });
  expect(createTicketFromJson).not.toHaveBeenCalled();
});

test("passes through ticket idempotency and retry information", async () => {
  const { ApiError } = await import("@/lib/api-contracts");
  createTicketFromJson
    .mockResolvedValueOnce({ replayed: true, response: { id: "ticket" } })
    .mockRejectedValueOnce(new ApiError({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      type: "unavailable",
      message: "Try again later.",
      retryAfterSeconds: 60,
    }));

  await withClient("test-write", async (client) => {
    const request = { name: "create_ticket", arguments: createArgs };
    expect(await client.callTool(request)).toMatchObject({
      structuredContent: {
        http_status: 201,
        idempotent_replayed: true,
        response: { data: { id: "ticket" } },
      },
    });
    expect(await client.callTool(request)).toMatchObject({
      isError: true,
      structuredContent: {
        http_status: 503,
        retry_after_seconds: 60,
        response: { error: { code: "SERVICE_UNAVAILABLE", retryable: true } },
      },
    });
  });

  expect(createTicketFromJson).toHaveBeenCalledWith(expect.objectContaining({
    organizationId: "org-from-key",
    mode: "test",
    idempotencyKey: "ticket-001",
    body: { tax_id: "EKU9003173C9", file: "base64" },
  }));
});
