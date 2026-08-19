import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { randomOrgColor } from "@/lib/org-branding";
import { ensureCreditAccount } from "@/lib/credits";

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
  plugins: [
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
