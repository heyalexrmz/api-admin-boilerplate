import { mcpAuthorizationIssuer, mcpResourceUrl, mcpScopes } from "@/lib/mcp-config";

export function GET() {
  return Response.json({
    resource: mcpResourceUrl(),
    resource_name: "Taxo Timbre MCP",
    authorization_servers: [mcpAuthorizationIssuer()],
    bearer_methods_supported: ["header"],
    scopes_supported: mcpScopes,
  }, { headers: { "Access-Control-Allow-Origin": "*" } });
}
