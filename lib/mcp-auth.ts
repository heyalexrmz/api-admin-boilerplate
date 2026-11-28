import "server-only";

import { and, arrayContains, eq, gt, isNull, or } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, oauthClient, oauthConsent, organization, session } from "@/lib/db/schema";
import { mcpAuthorizationIssuer, mcpResourceMetadataUrl, mcpResourceUrl, mcpScope, mcpScopes } from "@/lib/mcp-config";
import type { ApiRouteIdentity } from "@/lib/api-route-handler";

export function mcpChallenge(error?: "invalid_token") {
  const challenge = `Bearer resource_metadata="${mcpResourceMetadataUrl()}", scope="${mcpScopes.join(" ")}"`;
  return Response.json({ error: error ?? "unauthorized" }, {
    status: 401,
    headers: {
      "WWW-Authenticate": error ? `${challenge}, error="${error}"` : challenge,
      "Cache-Control": "no-store",
    },
  });
}

export async function authenticateMcp(request: Request): Promise<ApiRouteIdentity | Response> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return mcpChallenge();

  const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization)?.[1];
  if (!token) return mcpChallenge("invalid_token");

  const { payload } = await auth.api.verifyJWT({ body: { token, issuer: mcpAuthorizationIssuer() } });
  if (!payload || payload.aud !== mcpResourceUrl() || typeof payload.exp !== "number" ||
      typeof payload.sub !== "string" || typeof payload.sid !== "string" ||
      typeof payload.azp !== "string" || typeof payload.taxo_organization_id !== "string" ||
      typeof payload.scope !== "string" || !payload.scope.split(" ").includes(mcpScope)) {
    return mcpChallenge("invalid_token");
  }

  const [workspace] = await db.select({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role: member.role,
  }).from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .innerJoin(session, and(eq(session.userId, member.userId), eq(session.id, payload.sid), gt(session.expiresAt, new Date())))
    .innerJoin(oauthConsent, and(
      eq(oauthConsent.userId, member.userId),
      eq(oauthConsent.referenceId, organization.id),
      eq(oauthConsent.clientId, payload.azp),
      arrayContains(oauthConsent.scopes, [mcpScope])
    ))
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
    .where(and(
      eq(member.userId, payload.sub),
      eq(organization.id, payload.taxo_organization_id),
      or(eq(oauthClient.disabled, false), isNull(oauthClient.disabled))
    ))
    .limit(1);

  if (!workspace) return mcpChallenge("invalid_token");

  return {
    ok: true,
    key: {
      id: null,
      organizationId: workspace.id,
      name: "MCP OAuth",
      mode: "live",
      scopes: workspace.role === "owner" || workspace.role === "admin"
        ? ["read", "write", "billing"]
        : ["read"],
    },
    organization: { id: workspace.id, name: workspace.name, slug: workspace.slug },
  };
}
