import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, jwt, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { randomOrgColor } from "@/lib/org-branding";
import { ensureCreditAccount } from "@/lib/credits";
import { isMcpResource, mcpAuthorizationIssuer, mcpResourceUrl, mcpScope, mcpScopes } from "@/lib/mcp-config";
import { mcpWorkspace } from "@/lib/mcp-workspace";

const turnstileEnabled =
  process.env.NODE_ENV === "production" &&
  !!process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: false },
      lastName: { type: "string", required: false },
      bio: { type: "string", required: false },
      timezone: { type: "string", required: false },
    },
    deleteUser: { enabled: true },
  },
  disabledPaths: ["/token"],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/oauth2/token") {
        if (!isMcpResource(ctx.body?.resource)) {
          throw new APIError("BAD_REQUEST", { error: "invalid_target", error_description: "Use the Taxo Timbre MCP resource URL." });
        }
        ctx.body.resource = mcpResourceUrl();
      }
      if (ctx.path !== "/oauth2/consent" || ctx.body?.accept !== true) return;
      const current = await getSessionFromCtx(ctx);
      const workspace = current && await mcpWorkspace(current.user.id, current.session.activeOrganizationId);
      if (!workspace || ctx.headers?.get("x-taxo-organization") !== workspace.organizationId) {
        throw new APIError("FORBIDDEN", { message: "The workspace changed. Restart authorization." });
      }
    }),
  },
  plugins: [
    jwt({
      disableSettingJwtHeader: true,
      jwt: { issuer: mcpAuthorizationIssuer(), audience: mcpResourceUrl() },
    }),
    oauthProvider({
      loginPage: "/oauth/login",
      consentPage: "/oauth/consent",
      scopes: [...mcpScopes],
      validAudiences: [mcpResourceUrl()],
      grantTypes: ["authorization_code", "refresh_token"],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultScopes: [...mcpScopes],
      accessTokenExpiresIn: 900,
      silenceWarnings: { oauthAuthServerConfig: true },
      postLogin: {
        page: "/oauth/consent",
        shouldRedirect: () => false,
        consentReferenceId: async ({ user, session }) => {
          const workspace = await mcpWorkspace(user.id, session.activeOrganizationId);
          if (!workspace) throw new APIError("FORBIDDEN", { message: "A workspace is required." });
          return workspace.organizationId;
        },
      },
      customAccessTokenClaims: ({ user, referenceId, scopes }) =>
        user && referenceId && scopes.includes(mcpScope) ? { taxo_organization_id: referenceId } : {},
    }),
    ...(turnstileEnabled
      ? [
          captcha({
            provider: "cloudflare-turnstile" as const,
            secretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY!,
            endpoints: [
              "/sign-in/email",
              "/sign-up/email",
              "/request-password-reset",
            ],
            expectedAction: "password_auth",
          }),
        ]
      : []),
    organization({
      allowUserToCreateOrganization: async (authUser) => {
        const [row] = await db
          .select({
            platformRole: schema.user.platformRole,
            membershipId: schema.member.id,
          })
          .from(schema.user)
          .leftJoin(schema.member, eq(schema.member.userId, schema.user.id))
          .where(eq(schema.user.id, authUser.id))
          .limit(1);

        return row?.platformRole === "superadmin" || !row?.membershipId;
      },
      schema: {
        organization: {
          additionalFields: {
            color: { type: "string", required: false },
          },
        },
      },
      organizationHooks: {
        beforeCreateOrganization: async ({ organization: org }) => ({
          data: {
            ...org,
            color: randomOrgColor(),
          },
        }),
        afterCreateOrganization: async ({ organization: org }) => {
          await ensureCreditAccount(org.id);
        },
      },
    }),
  ],
});
