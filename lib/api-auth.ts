import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { apiKey, organization } from "@/lib/db/schema";
import { hashSecret } from "@/lib/api-keys";

export type AuthenticatedKey = {
  id: string;
  name: string;
  scopes: string[];
  organizationId: string;
};

export type AuthenticatedOrg = {
  id: string;
  name: string;
  slug: string;
};

export type ApiKeyAuthSuccess = {
  ok: true;
  key: AuthenticatedKey;
  organization: AuthenticatedOrg;
};

export type ApiKeyAuthErrorCode =
  | "missing_authorization"
  | "invalid_scheme"
  | "invalid_api_key";

export type ApiKeyAuthFailure = {
  ok: false;
  status: 401;
  code: ApiKeyAuthErrorCode;
  message: string;
};

export type ApiKeyAuthResult = ApiKeyAuthSuccess | ApiKeyAuthFailure;

const BEARER_PREFIX = "Bearer ";

/**
 * Authenticates an incoming request using a `Authorization: Bearer <secret>`
 * header. The plaintext secret is never stored, so we hash it and look up the
 * matching row. Revoked or expired keys are rejected as `invalid_api_key` so
 * the failure reason doesn't leak whether a key exists.
 *
 * On success, the key's `lastUsedAt` is bumped. This is a write on every
 * authenticated request — expected for a usage-tracked API.
 */
export async function authenticateApiKey(
  req: Request
): Promise<ApiKeyAuthResult> {
  const header = req.headers.get("authorization");
  if (!header) {
    return {
      ok: false,
      status: 401,
      code: "missing_authorization",
      message: "Missing Authorization header.",
    };
  }
  if (!header.startsWith(BEARER_PREFIX)) {
    return {
      ok: false,
      status: 401,
      code: "invalid_scheme",
      message: "Authorization header must use the Bearer scheme.",
    };
  }

  const secret = header.slice(BEARER_PREFIX.length).trim();
  if (!secret) {
    return {
      ok: false,
      status: 401,
      code: "invalid_api_key",
      message: "Invalid API key.",
    };
  }

  const hash = hashSecret(secret);
  const now = new Date();

  const rows = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      scopes: apiKey.scopes,
      organizationId: apiKey.organizationId,
      orgName: organization.name,
      orgSlug: organization.slug,
    })
    .from(apiKey)
    .innerJoin(organization, eq(organization.id, apiKey.organizationId))
    .where(
      and(
        eq(apiKey.hash, hash),
        isNull(apiKey.revokedAt),
        or(isNull(apiKey.expiresAt), gt(apiKey.expiresAt, now))
      )
    )
    .limit(1);

  const found = rows[0];
  if (!found) {
    return {
      ok: false,
      status: 401,
      code: "invalid_api_key",
      message: "Invalid, revoked, or expired API key.",
    };
  }

  await db
    .update(apiKey)
    .set({ lastUsedAt: now })
    .where(eq(apiKey.id, found.id));

  return {
    ok: true,
    key: {
      id: found.id,
      name: found.name,
      scopes: found.scopes,
      organizationId: found.organizationId,
    },
    organization: {
      id: found.organizationId,
      name: found.orgName,
      slug: found.orgSlug,
    },
  };
}
