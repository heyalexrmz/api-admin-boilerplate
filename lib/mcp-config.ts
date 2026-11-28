export const productionMcpUrl = "https://mcp.taxotimbre.com";
export const mcpScope = "mcp:access";
export const mcpScopes = [mcpScope, "offline_access"] as const;

export function mcpResourceUrl() {
  return new URL(
    process.env.MCP_RESOURCE_URL ??
      (process.env.NODE_ENV === "production"
        ? productionMcpUrl
        : new URL("/api/mcp", process.env.BETTER_AUTH_URL ?? "http://localhost:3000"))
  ).href;
}

export function mcpAuthorizationIssuer() {
  return new URL("/api/auth", process.env.BETTER_AUTH_URL ?? "http://localhost:3000").href;
}

export function mcpResourceMetadataUrl() {
  const resource = new URL(mcpResourceUrl());
  const path = resource.pathname === "/" ? "" : resource.pathname;
  return new URL(`/.well-known/oauth-protected-resource${path}`, resource).href;
}

export function isMcpResource(value: unknown) {
  const url = typeof value === "string" ? URL.parse(value) : null;
  return url?.href === mcpResourceUrl() && !url.username && !url.password;
}
