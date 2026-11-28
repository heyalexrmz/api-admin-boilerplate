import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { isMcpResource } from "@/lib/mcp-config";

const authHandler = toNextJsHandler(auth);

export async function GET(request: Request) {
  const url = new URL(request.url);
  // This provider version parses the RFC 8707 resource only at the token endpoint.
  if (url.pathname === "/api/auth/oauth2/authorize") {
    const resources = url.searchParams.getAll("resource");
    if (resources.length !== 1 || !isMcpResource(resources[0])) {
      return Response.json({ error: "invalid_target", error_description: "Use the Taxo Timbre MCP resource URL." }, { status: 400 });
    }
  }
  return authHandler.GET(request);
}

export async function POST(request: Request) {
  const response = await authHandler.POST(request);
  if (response.status === 200 && new URL(request.url).pathname === "/api/auth/oauth2/register") {
    return new Response(response.body, { status: 201, headers: response.headers });
  }
  return response;
}
