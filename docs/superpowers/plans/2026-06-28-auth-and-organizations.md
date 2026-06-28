# Authentication & Organizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock auth UI with a real Better Auth magic-link system, PostgreSQL + Drizzle persistence, Resend transactional email, an organization onboarding step, and org-scoped API keys.

**Architecture:** Better Auth (magic link + organization plugins) backed by a Drizzle adapter over Postgres (Docker Compose). A server DAL enforces auth next to the data; `proxy.ts` does optimistic cookie-only redirects. Magic-link emails are rendered with React Email and sent via Resend. API keys are org-scoped and stored as sha-256 hashes.

**Tech Stack:** Next.js 16.2.9 (App Router, `proxy.ts` convention), React 19, Better Auth, Drizzle ORM + drizzle-kit, node-postgres, Resend, React Email, shadcn/Tailwind v4, Vitest (pure helpers only).

## Global Constraints

- Next.js version is **16.2.9** — use `proxy.ts` (not `middleware.ts`) for route protection; `cookies()`/`headers()` are async (`await` them).
- Path alias `@/*` maps to the project root (`@/lib/db` → `./lib/db`).
- Magic link only — **no passwords**. Disable `emailAndPassword`.
- API key secrets are **never** stored as plaintext; persist sha-256 `hash` + masked `preview` only.
- Local Postgres via **Docker Compose**: `postgresql://demo:demo@localhost:5432/demo`.
- Dev `from` for Resend is `Acme <onboarding@resend.dev>` (sandbox sender).
- `better-auth` adapter import: prefer in-core `better-auth/adapters/drizzle`; if the installed version does not export it, install `@better-auth/drizzle-adapter` and import from there.
- Social/SSO buttons remain in the UI but are **not wired** (out of scope).

## File Structure

**Create:**
- `docker-compose.yml` — local Postgres 17.
- `.env.example` — env template (committed); `.env` is gitignored.
- `drizzle.config.ts` — drizzle-kit config.
- `lib/db/index.ts` — Drizzle `Pool` instance + `db`.
- `lib/db/schema/index.ts` — barrel re-export of all schema.
- `lib/db/schema/auth.ts` — Better Auth core + organization plugin tables (with custom `bio`/`timezone` on `user`).
- `lib/db/schema/api-keys.ts` — `api_key` table.
- `lib/db/schema/request-logs.ts` — `request_log` table + `http_method` enum.
- `lib/auth.ts` — Better Auth server instance.
- `lib/auth-client.ts` — Better Auth React client.
- `lib/email/resend.ts` — Resend client + `sendEmail` / `sendMagicLinkEmail`.
- `emails/magic-link.tsx` — React Email magic-link template.
- `app/api/auth/[...all]/route.ts` — Better Auth route handler.
- `app/lib/auth.ts` — server DAL (`server-only`).
- `proxy.ts` — optimistic route protection.
- `components/magic-link-form.tsx` — email-only sign-in form.
- `components/onboarding-form.tsx` — create-organization form.
- `app/onboarding/page.tsx` — onboarding route (server component).
- `lib/slug.ts` — `slugify` / `isSlugValid` (pure).
- `lib/api-keys.ts` — `generateSecret` / `hashSecret` / `maskSecret` / `computeExpiry` / `deriveKeyStatus` (pure).
- `vitest.config.ts` — Vitest config.
- `tests/slug.test.ts`, `tests/api-keys.test.ts` — unit tests.

**Modify:**
- `package.json` — deps + scripts.
- `app/page.tsx`, `app/signup/page.tsx` — use `MagicLinkForm`.
- `app/dashboard/layout.tsx` — server component, require active org (redirect to `/onboarding` if none).
- `components/app-sidebar.tsx`, `components/nav-user.tsx` — real user + org + sign out.
- `app/actions/api-keys.ts` — rewrite with DB + DAL + hashing.
- `app/invite/page.tsx`, `components/invite-form.tsx` — real invitation acceptance.
- `app/lib/definitions.ts` — prune password schemas; keep API key types.

**Delete:**
- `app/forgot-password/`, `app/forgot-password/sent/`, `app/reset-password/`, `app/verify-email/`
- `components/login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `verify-email-form.tsx`, `resend-reset-email-button.tsx`, `reset-success-alert.tsx`
- `app/actions/auth.ts` (mock password actions) — replaced by Better Auth client + a `signOut` helper.

---

### Task 1: Database infrastructure & connection

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env`, `drizzle.config.ts`, `lib/db/index.ts`
- Modify: `package.json` (deps + scripts)

**Interfaces:**
- Produces: `db` (Drizzle instance) at `@/lib/db`; `DATABASE_URL` env; scripts `db:up`, `db:push`, `db:studio`.

- [ ] **Step 1: Add dependencies and scripts**

Run:
```bash
pnpm add drizzle-orm pg better-auth resend @react-email/components @react-email/render react-email
pnpm add -D drizzle-kit @types/pg vitest
```

Add to `package.json` `scripts`:
```json
"db:up": "docker compose up -d",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"email:dev": "email dev --port 3030",
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:17
    container_name: demo-glm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: demo
      POSTGRES_PASSWORD: demo
      POSTGRES_DB: demo
    ports:
      - "5432:5432"
    volumes:
      - demo-glm-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U demo -d demo"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  demo-glm-pgdata:
```

- [ ] **Step 3: Write `.env.example` and `.env`**

`.env.example` (committed):
```
# Database
DATABASE_URL=postgresql://demo:demo@localhost:5432/demo

# Better Auth
BETTER_AUTH_SECRET=replace-with-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM=Acme <onboarding@resend.dev>
```

`.env` (gitignored, local): copy `.env.example` and set `BETTER_AUTH_SECRET` to the output of `openssl rand -base64 32`. Leave `RESEND_API_KEY` as a placeholder for now.

- [ ] **Step 4: Write `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/*.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 5: Write `lib/db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({ pool, schema });
export type DB = typeof db;
```

- [ ] **Step 6: Start Postgres and verify the connection**

Run:
```bash
pnpm db:up
```
Expected: container `demo-glm-postgres` starts, healthcheck becomes healthy. Create a temporary empty `lib/db/schema/index.ts` (`export {}`) so the import resolves, then run `pnpm db:push`. Expected: drizzle-kit connects and reports no schema changes (empty schema). Remove the temporary file before committing.

- [ ] **Step 7: Ensure `.env` is gitignored and commit**

Add `.env` to `.gitignore` if not present. Commit infra:
```bash
git add docker-compose.yml .env.example drizzle.config.ts lib/db/index.ts package.json pnpm-lock.yaml .gitignore
git commit -m "Add PostgreSQL via Docker Compose and Drizzle connection"
```

---

### Task 2: Schema (Better Auth core + organization + custom tables)

**Files:**
- Create: `lib/db/schema/auth.ts`, `lib/db/schema/api-keys.ts`, `lib/db/schema/request-logs.ts`, `lib/db/schema/index.ts`
- Modify: `package.json` (none)

**Interfaces:**
- Produces: tables `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `api_key`, `request_log`; enum `http_method`; Drizzle relations. `user` has custom `bio`, `timezone`.

- [ ] **Step 1: Write `lib/db/schema/auth.ts`**

```ts
import { relations } from "drizzle-orm";
import { boolean, primaryKey, text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  bio: text("bio"),
  timezone: text("timezone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at"),
  inviterId: text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  memberships: many(member),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, { fields: [member.organizationId], references: [organization.id] }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, { fields: [invitation.organizationId], references: [organization.id] }),
  inviter: one(user, { fields: [invitation.inviterId], references: [user.id] }),
}));
```

> Note: This matches Better Auth's documented field shapes for the core + organization plugin. If `npx @better-auth/cli generate` (run later, optional) emits a column that differs, reconcile by adopting the CLI output. The hand-written version above is the committed baseline.

- [ ] **Step 2: Write `lib/db/schema/api-keys.ts`**

```ts
import { relations } from "drizzle-orm";
import { text, timestamp, uuid, pgTable } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const apiKey = pgTable("api_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  hash: text("hash").notNull(),
  preview: text("preview").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  organization: one(organization, { fields: [apiKey.organizationId], references: [organization.id] }),
  createdBy: one(user, { fields: [apiKey.createdByUserId], references: [user.id] }),
}));
```

- [ ] **Step 3: Write `lib/db/schema/request-logs.ts`**

```ts
import { relations } from "drizzle-orm";
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { apiKey } from "./api-keys";

export const httpMethod = pgEnum("http_method", ["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const requestLog = pgTable("request_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  apiKeyId: uuid("api_key_id").references(() => apiKey.id, { onDelete: "set null" }),
  requestId: text("request_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  method: httpMethod("method").notNull(),
  path: text("path").notNull(),
  status: integer("status").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  ip: text("ip").notNull(),
  userAgent: text("user_agent").notNull(),
  requestHeaders: jsonb("request_headers").notNull(),
  requestBody: text("request_body"),
  responseHeaders: jsonb("response_headers").notNull(),
  responseBody: text("response_body"),
});

export const requestLogRelations = relations(requestLog, ({ one }) => ({
  organization: one(organization, { fields: [requestLog.organizationId], references: [organization.id] }),
  apiKey: one(apiKey, { fields: [requestLog.apiKeyId], references: [apiKey.id] }),
}));
```

- [ ] **Step 4: Write `lib/db/schema/index.ts` (barrel)**

```ts
export * from "./auth";
export * from "./api-keys";
export * from "./request-logs";
```

- [ ] **Step 5: Push schema to the database**

Run:
```bash
pnpm db:push
```
Expected: drizzle-kit creates all tables. Verify with `pnpm db:studio` (opens Drizzle Studio at the printed URL) — confirm `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `api_key`, `request_log` exist.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema
git commit -m "Add Drizzle schema for auth, organizations, API keys, request logs"
```

---

### Task 3: Better Auth instance, client, route handler, DAL, proxy

**Files:**
- Create: `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `app/lib/auth.ts`, `proxy.ts`
- Modify: `lib/email/resend.ts` is referenced by `lib/auth.ts` but created in Task 4 — to avoid a broken import, create a temporary stub `lib/email/resend.ts` here with `export async function sendMagicLinkEmail() {}` and replace it in Task 4.

**Interfaces:**
- Produces: `auth` (`@/lib/auth`), `authClient`/`signIn`/`signOut`/`useSession` (`@/lib/auth-client`), DAL `getSession`/`getUser`/`requireUser`/`getUserOrganizations`/`getActiveOrganization`/`requireActiveOrganization` (`@/app/lib/auth`), `proxy.ts` default export.

- [ ] **Step 1: Create temporary `lib/email/resend.ts` stub**

```ts
export async function sendMagicLinkEmail(_email: string, _url: string): Promise<void> {}
```

- [ ] **Step 2: Write `lib/auth.ts`**

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, organization } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendMagicLinkEmail } from "@/lib/email/resend";

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
  emailAndPassword: { enabled: false },
  user: {
    additionalFields: {
      bio: { type: "string", required: false },
      timezone: { type: "string", required: false },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
    organization(),
  ],
});
```

> If `better-auth/adapters/drizzle` does not resolve, run `pnpm add @better-auth/drizzle-adapter` and change the import to `from "@better-auth/drizzle-adapter"`.

- [ ] **Step 3: Write `lib/auth-client.ts`**

```ts
import { createAuthClient } from "better-auth/react";
import { magicLinkClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), organizationClient()],
});

export const { signIn, signOut, useSession } = authClient;
```

- [ ] **Step 4: Write `app/api/auth/[...all]/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 5: Write `app/lib/auth.ts` (DAL)**

```ts
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";

export const getSession = cache(async () => {
  return await auth.api.getSession({ headers: await headers() });
});

export const getUser = cache(async () => {
  const session = await getSession();
  return session?.user ?? null;
});

export const requireUser = cache(async () => {
  const user = await getUser();
  if (!user) redirect("/");
  return user;
});

export const getUserOrganizations = cache(async () => {
  const session = await getSession();
  if (!session) return [];
  const rows = await db.query.member.findMany({
    where: eq(member.userId, session.user.id),
    with: { organization: true },
  });
  return rows.map((r) => r.organization);
});

export const getActiveOrganization = cache(async () => {
  const orgs = await getUserOrganizations();
  return orgs[0] ?? null;
});

export const requireActiveOrganization = cache(async () => {
  const user = await requireUser();
  const org = await getActiveOrganization();
  if (!org) redirect("/onboarding");
  return { user, organization: org };
});
```

> `getActiveOrganization` returns the user's first organization (single-org or default-to-first behavior per the spec; a full active-org switcher is future polish).

- [ ] **Step 6: Write `proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedPrefixes = ["/dashboard", "/onboarding"];
const authRoutes = ["/", "/signup"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => path === p || path.startsWith(p + "/"));
  const isAuthRoute = authRoutes.includes(path);
  if (!isProtected && !isAuthRoute) return NextResponse.next();

  const isAuthed = !!getSessionCookie(req);

  if (isProtected && !isAuthed) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  if (isAuthRoute && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
```

> Org routing is intentionally **not** in the proxy (no DB hits). The dashboard layout (Task 8) redirects org-less users to `/onboarding` via the DAL.

- [ ] **Step 7: Type-check and verify the auth endpoint**

Run `pnpm exec tsc --noEmit`. Expected: no errors. Start `pnpm dev` and `curl http://localhost:3000/api/auth/ok`. Expected: a 200 JSON body like `{ "ok": true }` (Better Auth's health endpoint).

- [ ] **Step 8: Commit**

```bash
git add lib/auth.ts lib/auth-client.ts app/api/auth app/lib/auth.ts proxy.ts lib/email/resend.ts
git commit -m "Wire Better Auth: instance, client, route handler, DAL, proxy"
```

---

### Task 4: Email — Resend + React Email template + preview

**Files:**
- Create: `emails/magic-link.tsx`, `react-email.config.ts`
- Modify: `lib/email/resend.ts` (replace stub), `package.json` (none — `email:dev` script added in Task 1)

**Interfaces:**
- Produces: `sendEmail({ to, subject, react })`, `sendMagicLinkEmail(email, url)` at `@/lib/email/resend`; `MagicLinkEmail` default export at `@/emails/magic-link`.

- [ ] **Step 1: Write `emails/magic-link.tsx`**

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

export default function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html>
      <Head />
      <Preview>Sign in to your Acme workspace</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "480px" }}>
          <Heading style={{ fontSize: "20px" }}>Your Acme sign-in link</Heading>
          <Text>Click the button below to sign in to your Acme workspace. This link expires shortly and can only be used once.</Text>
          <Link
            href={url}
            style={{ display: "inline-block", backgroundColor: "#000", color: "#fff", padding: "12px 20px", borderRadius: "6px", textDecoration: "none" }}
          >
            Sign in to Acme
          </Link>
          <Text style={{ color: "#666", fontSize: "13px" }}>If you didn&apos;t request this link, you can safely ignore this email.</Text>
          <Hr />
          <Text style={{ color: "#999", fontSize: "12px" }}>Acme Inc.</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 2: Write `react-email.config.ts`**

```ts
export default {
  port: 3030,
};
```

- [ ] **Step 3: Replace `lib/email/resend.ts`**

```ts
import { Resend } from "resend";
import MagicLinkEmail from "@/emails/magic-link";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "Acme <onboarding@resend.dev>",
    to,
    subject,
    react,
  });
  if (error) {
    console.error("Resend send failed", error);
    throw new Error(`Failed to send email: ${error.name}`);
  }
}

export async function sendMagicLinkEmail(email: string, url: string) {
  await sendEmail({
    to: email,
    subject: "Your Acme sign-in link",
    react: MagicLinkEmail({ url }),
  });
}
```

- [ ] **Step 4: Verify the preview server and type-check**

Run `pnpm email:dev`. Expected: React Email preview server starts at `http://localhost:3030` and renders the magic-link template. Run `pnpm exec tsc --noEmit`. Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add emails lib/email/resend.ts react-email.config.ts
git commit -m "Add Resend + React Email magic-link template"
```

---

### Task 5: MagicLinkForm + rewire `/` and `/signup`

**Files:**
- Create: `components/magic-link-form.tsx`
- Modify: `app/page.tsx`, `app/signup/page.tsx`

**Interfaces:**
- Consumes: `signIn.magicLink({ email, callbackURL })` from `@/lib/auth-client`.
- Produces: `MagicLinkForm` component (props `title?`, `subtitle?`).

- [ ] **Step 1: Write `components/magic-link-form.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Mail, TriangleAlert } from "lucide-react";

import { signIn } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleIcon, MicrosoftIcon } from "@/components/brand-icons";

export function MagicLinkForm({
  title = "Welcome back",
  subtitle = "Enter your email and we'll send a secure sign-in link.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: signInError } = await signIn.magicLink({ email, callbackURL: "/" });
    setPending(false);
    if (signInError) {
      setError(signInError.message ?? "Something went wrong. Please try again.");
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h3 className="text-lg font-semibold">Check your inbox</h3>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>. Click it to sign in.
        </p>
        <Button variant="link" onClick={() => { setSent(false); setEmail(""); }} className="mx-auto">
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Work email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Sending link…" : "Send magic link"}
      </Button>

      <div className="relative py-1">
        <Separator />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
          or continue with
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-10">
          <GoogleIcon className="size-4" />
          Google
        </Button>
        <Button type="button" variant="outline" className="h-10" asChild>
          <Link href="/sso">
            <MicrosoftIcon className="size-4" />
            Microsoft
          </Link>
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
import { AuthShell } from "@/components/auth-shell";
import { MagicLinkForm } from "@/components/magic-link-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <AuthShell
      footer={
        <>
          By signing in you agree to our{" "}
          <a href="#" className="underline-offset-4 hover:text-foreground hover:underline">Terms</a>{" "}
          and{" "}
          <a href="#" className="underline-offset-4 hover:text-foreground hover:underline">Privacy Policy</a>.
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-balance">Welcome back</CardTitle>
          <CardDescription className="text-pretty">Sign in to your Acme workspace to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <MagicLinkForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
```

- [ ] **Step 3: Replace `app/signup/page.tsx`**

Use the same `AuthShell` + `Card` shell, but render `<MagicLinkForm title="Create your account" subtitle="Enter your email and we'll send a link to get you started." />`. Keep the existing signup page's surrounding shell/marketing copy if any; the only functional change is swapping the form and removing password fields.

- [ ] **Step 4: Verify manually**

`pnpm dev`, open `/`, enter an email, click **Send magic link**. Expected: form switches to "Check your inbox" state (the actual email send will fail without a valid `RESEND_API_KEY`, which is fine — verify the UI state and that no server error crashes the page). Repeat on `/signup`.

- [ ] **Step 5: Commit**

```bash
git add components/magic-link-form.tsx app/page.tsx app/signup/page.tsx
git commit -m "Replace password forms with magic-link form"
```

---

### Task 6: Delete password pages & prune definitions

**Files:**
- Delete: `app/forgot-password/` (incl. `app/forgot-password/sent/`), `app/reset-password/`, `app/verify-email/`
- Delete: `components/login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `verify-email-form.tsx`, `resend-reset-email-button.tsx`, `reset-success-alert.tsx`
- Delete: `app/actions/auth.ts`
- Modify: `app/lib/definitions.ts` (remove password schemas), `components/auth-shell.tsx` (remove any dead links)

**Interfaces:**
- Produces: no password-related exports remain; API key types (`ApiKey`, `NewApiKey`, `RotatedApiKey`, scopes/expiries, `CreateApiKeyFormSchema`, `RenameApiKeyFormSchema`) and `ProfileFormSchema` stay.

- [ ] **Step 1: Delete the password routes and components**

Run:
```bash
rm -rf app/forgot-password app/reset-password app/verify-email
rm -f components/login-form.tsx components/signup-form.tsx components/forgot-password-form.tsx components/reset-password-form.tsx components/verify-email-form.tsx components/resend-reset-email-button.tsx components/reset-success-alert.tsx
rm -f app/actions/auth.ts
```

- [ ] **Step 2: Prune `app/lib/definitions.ts`**

Remove `LoginFormSchema`, `SignupFormSchema`, `ForgotPasswordFormSchema`, `ResetPasswordFormSchema`, `InviteFormSchema`, `VerifyEmailFormSchema`, `SsoFormSchema`, `passwordSchema`, and the `LoginState`/`SignupState`/`ForgotPasswordState`/`ResetPasswordState`/`InviteState`/`VerifyEmailState`/`SsoState` types. Keep `AuthFormState` only if still referenced; otherwise remove. Keep all API key types, `ProfileFormSchema`, `ChangePasswordFormSchema` is removed (no passwords — remove it and `passwordSchema`).

- [ ] **Step 3: Remove dead links in `components/auth-shell.tsx`**

Open `components/auth-shell.tsx`; remove any links pointing at `/forgot-password`, `/reset-password`, or `/verify-email`. Keep links to `/` and `/signup`.

- [ ] **Step 4: Verify the build**

Run `pnpm exec tsc --noEmit` and `pnpm build`. Expected: no errors and no references to deleted files. Fix any lingering imports of removed modules.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove password-based auth pages and schemas"
```

---

### Task 7: Onboarding (org creation) with slugify + Vitest setup

**Files:**
- Create: `lib/slug.ts`, `vitest.config.ts`, `tests/slug.test.ts`, `components/onboarding-form.tsx`, `app/onboarding/page.tsx`
- Modify: `package.json` (test scripts added in Task 1)

**Interfaces:**
- Consumes: `getUser`, `getUserOrganizations` from `@/app/lib/auth`; `authClient.organization.create({ name, slug })`, `authClient.organization.setActive({ slug })` from `@/lib/auth-client`; `slugify`, `isSlugValid` from `@/lib/slug`.
- Produces: `slugify`, `isSlugValid` at `@/lib/slug`; `/onboarding` route.

- [ ] **Step 1: Write `lib/slug.ts`**

```ts
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function isSlugValid(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug);
}
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": resolve(__dirname) } },
});
```

- [ ] **Step 3: Write the failing test `tests/slug.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { slugify, isSlugValid } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Acme Inc.")).toBe("acme-inc");
    expect(slugify("  My Cool Org! ")).toBe("my-cool-org");
  });
  it("strips non-alphanumerics", () => {
    expect(slugify("a..b//c")).toBe("a-b-c");
  });
  it("trims leading/trailing hyphens", () => {
    expect(slugify("---hi---")).toBe("hi");
  });
  it("truncates to 48 chars", () => {
    expect(slugify("a".repeat(100)).length).toBe(48);
  });
  it("returns empty for no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("isSlugValid", () => {
  it("accepts valid slugs", () => {
    expect(isSlugValid("acme")).toBe(true);
    expect(isSlugValid("acme-inc")).toBe(true);
  });
  it("rejects uppercase, spaces, leading/trailing hyphen", () => {
    expect(isSlugValid("Acme")).toBe(false);
    expect(isSlugValid("ac me")).toBe(false);
    expect(isSlugValid("-acme")).toBe(false);
    expect(isSlugValid("acme-")).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/slug.test.ts`
Expected: PASS (the implementation already satisfies the test — write the test first conceptually, then confirm green).

- [ ] **Step 5: Write `components/onboarding-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { isSlugValid, slugify } from "@/lib/slug";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugInvalid = slugTouched && slug.length > 0 && !isSlugValid(slug);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalSlug = effectiveSlug || slugify(name);
    if (!name || !finalSlug || !isSlugValid(finalSlug)) {
      setError("Enter an organization name with a valid slug.");
      return;
    }
    setPending(true);
    const { error: createError } = await authClient.organization.create({ name, slug: finalSlug });
    if (createError) {
      setPending(false);
      setError(createError.message ?? "Could not create organization. That slug may be taken.");
      return;
    }
    await authClient.organization.setActive({ slug: finalSlug });
    setPending(false);
    router.push("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." autoFocus required className="h-10" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-slug">Slug</Label>
        <Input
          id="org-slug"
          value={effectiveSlug}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
          placeholder="acme-inc"
          className="h-10"
          aria-invalid={slugInvalid}
        />
        {slugInvalid && <p className="text-sm text-destructive">Use lowercase letters, numbers, and hyphens.</p>}
        <p className="text-xs text-muted-foreground">Used in URLs and API identifiers.</p>
      </div>

      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Creating workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Write `app/onboarding/page.tsx`**

```tsx
import { redirect } from "next/navigation";

import { getUser, getUserOrganizations } from "@/app/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/");

  const orgs = await getUserOrganizations();
  if (orgs.length > 0) redirect("/dashboard");

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-balance">Create your organization</CardTitle>
          <CardDescription className="text-pretty">Tell us a bit about your team to set up your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
```

- [ ] **Step 7: Verify manually**

`pnpm dev`. With a session cookie present and no organizations, navigating to `/onboarding` shows the form. Submitting with a valid `RESEND_API_KEY`/DB creates an `organization` + `member` row (verify in Drizzle Studio) and redirects to `/dashboard`. (If no live session yet, verify the page renders without throwing and the guard logic is correct by inspecting behavior once auth is exercisable end-to-end in Task 8.)

- [ ] **Step 8: Commit**

```bash
git add lib/slug.ts vitest.config.ts tests/slug.test.ts components/onboarding-form.tsx app/onboarding
git commit -m "Add organization onboarding step with slugify helpers and tests"
```

---

### Task 8: Dashboard auth wiring (active org, sidebar user, sign out)

**Files:**
- Modify: `app/dashboard/layout.tsx`, `components/app-sidebar.tsx`, `components/nav-user.tsx`

**Interfaces:**
- Consumes: `requireActiveOrganization`, `getUserOrganizations` from `@/app/lib/auth`; `authClient.signOut`, `useSession`/`authClient` from `@/lib/auth-client`.

- [ ] **Step 1: Convert `app/dashboard/layout.tsx` to a server component that requires an active org**

```tsx
import { requireActiveOrganization } from "@/app/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organization } = await requireActiveOrganization();
  return <DashboardShell user={user} organization={organization}>{children}</DashboardShell>;
}
```

> `DashboardShell` becomes a thin client wrapper that accepts `user` and `organization` props and threads them into the sidebar. Keep its existing sidebar/header logic; only add the two props and forward them to `AppSidebar`.

- [ ] **Step 2: Update `components/dashboard-shell.tsx` to accept and forward `user`/`organization`**

Add props `user: { id: string; name: string; email: string; image?: string | null }` and `organization: { id: string; name: string; slug: string }`. Pass them to `<AppSidebar user={user} organization={organization} />`. Leave the rest of the shell (header actions context, nav items) unchanged.

- [ ] **Step 3: Update `components/app-sidebar.tsx` to show org + real user**

Accept `user` and `organization` props. Display the organization name in the sidebar header. Render `NavUser` with the real `user` (name, email, image).

- [ ] **Step 4: Update `components/nav-user.tsx` to use real user + sign out**

Replace mock user data with the `user` prop. The sign-out menu item calls `await authClient.signOut()` then `router.push("/")`:

```tsx
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

// inside the component:
const router = useRouter();
async function handleSignOut() {
  await authClient.signOut();
  router.push("/");
}
```

Wire `handleSignOut` to the existing "Sign out" menu item.

- [ ] **Step 5: Verify manually**

`pnpm dev`. Signed-in user with an org → dashboard renders with the org name in the sidebar and the real user in the nav menu; sign out redirects to `/`. Signed-in user with no org → `/dashboard` redirects to `/onboarding`.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/layout.tsx components/dashboard-shell.tsx components/app-sidebar.tsx components/nav-user.tsx
git commit -m "Wire dashboard to real auth: active org, real user, sign out"
```

---

### Task 9: API keys rewrite (helpers + tests + DB-backed actions)

**Files:**
- Create: `lib/api-keys.ts`, `tests/api-keys.test.ts`
- Modify: `app/actions/api-keys.ts`

**Interfaces:**
- Consumes: `requireActiveOrganization` from `@/app/lib/auth`; `apiKey` table + `db` from `@/lib/db`; `CreateApiKeyFormSchema`, `RenameApiKeyFormSchema`, `ApiKey`, `NewApiKey`, `RotatedApiKey` from `@/app/lib/definitions`.
- Produces: `generateSecret`, `hashSecret`, `maskSecret`, `computeExpiry`, `deriveKeyStatus` at `@/lib/api-keys`; DB-backed `createApiKey`, `revokeApiKey`, `renameApiKey`, `rotateApiKey` server actions.

- [ ] **Step 1: Write `lib/api-keys.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";
import type { ApiKeyExpiry, ApiKeyStatus } from "@/app/lib/definitions";

const EXPIRY_DAYS: Record<ApiKeyExpiry, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
  never: null,
};

export function generateSecret(): string {
  return `sk_live_${randomBytes(24).toString("hex")}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function maskSecret(secret: string): string {
  return `sk_live_${"•".repeat(8)}${secret.slice(-4)}`;
}

export function computeExpiry(expiry: ApiKeyExpiry): Date | null {
  const days = EXPIRY_DAYS[expiry];
  if (days === null) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function deriveKeyStatus(
  revokedAt: Date | null,
  expiresAt: Date | null,
  now: Date = new Date(),
): ApiKeyStatus {
  if (revokedAt) return "revoked";
  if (expiresAt && expiresAt <= now) return "expired";
  return "active";
}
```

- [ ] **Step 2: Write the failing test `tests/api-keys.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  generateSecret,
  hashSecret,
  maskSecret,
  computeExpiry,
  deriveKeyStatus,
} from "@/lib/api-keys";

describe("generateSecret", () => {
  it("has the sk_live_ prefix and a 48-char hex body", () => {
    expect(generateSecret()).toMatch(/^sk_live_[0-9a-f]{48}$/);
  });
});

describe("hashSecret", () => {
  it("is deterministic sha-256 hex", () => {
    expect(hashSecret("abc")).toBe(hashSecret("abc"));
    expect(hashSecret("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecret("abc")).not.toBe(hashSecret("abd"));
  });
});

describe("maskSecret", () => {
  it("masks the middle and keeps the last 4 chars", () => {
    expect(maskSecret("sk_live_1234567890abcd")).toBe("sk_live_••••••••abcd");
  });
});

describe("computeExpiry", () => {
  it("returns null for never", () => {
    expect(computeExpiry("never")).toBeNull();
  });
  it("adds the configured number of days", () => {
    const before = Date.now();
    const ms = computeExpiry("7d")!.getTime();
    const after = Date.now();
    expect(ms).toBeGreaterThanOrEqual(before + 7 * 86_400_000 - 1);
    expect(ms).toBeLessThanOrEqual(after + 7 * 86_400_000 + 1);
  });
});

describe("deriveKeyStatus", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  it("revoked wins over expired", () => {
    expect(deriveKeyStatus(new Date("2025-12-01"), new Date("2027-01-01"), now)).toBe("revoked");
  });
  it("expired when expiresAt <= now", () => {
    expect(deriveKeyStatus(null, new Date("2025-12-31"), now)).toBe("expired");
  });
  it("active otherwise", () => {
    expect(deriveKeyStatus(null, new Date("2027-01-01"), now)).toBe("active");
    expect(deriveKeyStatus(null, null, now)).toBe("active");
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `pnpm test`
Expected: all tests in `tests/slug.test.ts` and `tests/api-keys.test.ts` PASS.

- [ ] **Step 4: Rewrite `app/actions/api-keys.ts`**

```ts
"use server";

import { and, eq, isNull } from "drizzle-orm";

import { apiKey } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { requireActiveOrganization } from "@/app/lib/auth";
import {
  computeExpiry,
  deriveKeyStatus,
  generateSecret,
  hashSecret,
  maskSecret,
} from "@/lib/api-keys";
import {
  CreateApiKeyFormSchema,
  RenameApiKeyFormSchema,
  type ApiKey,
  type ApiKeyActionResponse,
  type CreateApiKeyState,
  type NewApiKey,
  type RenameApiKeyState,
  type RotatedApiKey,
} from "@/app/lib/definitions";

function toApiKey(row: typeof apiKey.$inferSelect): ApiKey {
  return {
    id: row.id,
    name: row.name,
    preview: row.preview,
    scopes: row.scopes,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
    status: deriveKeyStatus(row.revokedAt, row.expiresAt),
  };
}

export async function createApiKey(
  prevState: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const { user, organization } = await requireActiveOrganization();

  const validated = CreateApiKeyFormSchema.safeParse({
    name: formData.get("name"),
    scopes: formData.getAll("scopes"),
    expiry: formData.get("expiry"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, scopes, expiry } = validated.data;
  const secret = generateSecret();
  const expiresAt = computeExpiry(expiry);

  const [row] = await db
    .insert(apiKey)
    .values({
      organizationId: organization.id,
      createdByUserId: user.id,
      name,
      hash: hashSecret(secret),
      preview: maskSecret(secret),
      scopes,
      expiresAt,
    })
    .returning();

  if (!row) return { message: "Could not create the API key." };

  const newKey: NewApiKey = {
    id: row.id,
    name,
    secret,
    scopes,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: null,
    lastRotatedAt: null,
  };
  return { key: newKey };
}

export async function revokeApiKey(id: string): Promise<ApiKeyActionResponse> {
  const { organization } = await requireActiveOrganization();
  if (!id) return { error: "Missing key id." };

  const [updated] = await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKey.id, id), eq(apiKey.organizationId, organization.id), isNull(apiKey.revokedAt)))
    .returning({ id: apiKey.id });

  if (!updated) return { error: "Key not found or already revoked." };
  return { success: true as const };
}

export async function renameApiKey(
  prevState: RenameApiKeyState,
  formData: FormData,
): Promise<RenameApiKeyState> {
  const { organization } = await requireActiveOrganization();
  const id = String(formData.get("id") ?? "");
  if (!id) return { message: "Missing key id." };

  const validated = RenameApiKeyFormSchema.safeParse({ name: formData.get("name") });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const [updated] = await db
    .update(apiKey)
    .set({ name: validated.data.name })
    .where(and(eq(apiKey.id, id), eq(apiKey.organizationId, organization.id)))
    .returning({ name: apiKey.name });

  if (!updated) return { message: "Key not found." };
  return { name: updated.name };
}

export async function rotateApiKey(
  id: string,
): Promise<{ key: RotatedApiKey } | { error: string }> {
  const { organization } = await requireActiveOrganization();
  if (!id) return { error: "Missing key id." };

  const [existing] = await db
    .select({ revokedAt: apiKey.revokedAt })
    .from(apiKey)
    .where(and(eq(apiKey.id, id), eq(apiKey.organizationId, organization.id)));
  if (!existing) return { error: "Key not found." };
  if (existing.revokedAt) return { error: "Revoked keys can't be rotated." };

  const secret = generateSecret();
  const now = new Date();

  const [updated] = await db
    .update(apiKey)
    .set({ hash: hashSecret(secret), preview: maskSecret(secret), lastRotatedAt: now })
    .where(and(eq(apiKey.id, id), eq(apiKey.organizationId, organization.id)))
    .returning({ id: apiKey.id });

  if (!updated) return { error: "Key not found." };

  return {
    key: {
      id: updated.id,
      secret,
      preview: maskSecret(secret),
      lastRotatedAt: now.toISOString(),
    },
  };
}
```

- [ ] **Step 5: Verify manually**

`pnpm dev`, signed in with an org. Create a key → a row appears in `api_key` (hash + preview, no plaintext) and the secret is shown once. Rename, rotate (new secret, `lastRotatedAt` updates), revoke (`revokedAt` set, status becomes `revoked`). Confirm a key created in org A is not visible/mutable from org B by checking the `organizationId` filter.

- [ ] **Step 6: Commit**

```bash
git add lib/api-keys.ts tests/api-keys.test.ts app/actions/api-keys.ts
git commit -m "Rewrite API key actions as DB-backed and org-scoped"
```

---

### Task 10: Invite acceptance, session-expired, env docs, final smoke test

**Files:**
- Modify: `app/invite/page.tsx`, `components/invite-form.tsx`, `app/session-expired/page.tsx`
- Modify: `.env.example` (finalize), `README`-style notes only if requested

**Interfaces:**
- Consumes: `authClient.organization.acceptInvitation({ invitationId })` from `@/lib/auth-client`; `getUser` from `@/app/lib/auth`.

- [ ] **Step 1: Rewire `components/invite-form.tsx` to accept an invitation**

Replace the password-collecting form with one that reads an `invitationId` (from the page's search params) and calls `authClient.organization.acceptInvitation({ invitationId })`, then redirects to `/dashboard`. Show errors from the response.

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function InviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const invitationId = params.get("invitationId") ?? "";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    setError(null);
    if (!invitationId) {
      setError("This invitation link is incomplete.");
      return;
    }
    setPending(true);
    const { error: acceptError } = await authClient.organization.acceptInvitation({ invitationId });
    setPending(false);
    if (acceptError) {
      setError(acceptError.message ?? "Could not accept this invitation.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">Accept this invitation to join the organization.</p>
      <Button onClick={onAccept} disabled={pending} className="h-10">
        {pending ? "Accepting…" : "Accept invitation"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/invite/page.tsx`**

Wrap `<InviteForm />` in the existing `AuthShell` + `Card` shell. The page remains a client-capable route (it uses `useSearchParams`); ensure the component is wrapped in `<Suspense>` if Next requires it for `useSearchParams`.

- [ ] **Step 3: Wire `app/session-expired/page.tsx`**

Keep the page; ensure its "Sign in" link points to `/`. No DB changes.

- [ ] **Step 4: Finalize `.env.example` and confirm `.gitignore`**

Confirm `.env.example` matches the keys used (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM`) and `.env` is gitignored.

- [ ] **Step 5: Full smoke test**

1. `pnpm db:up && pnpm db:push`
2. Set a real `RESEND_API_KEY` in `.env` (or keep the sandbox sender for testing).
3. `pnpm dev`. Enter email at `/` → receive magic link → click → land on `/onboarding` (new user) → create org → land on `/dashboard`.
4. From the dashboard, create/rename/rotate/revoke an API key; verify rows in Drizzle Studio (`pnpm db:studio`).
5. Sign out → redirected to `/`; visiting `/dashboard` while signed out → redirected to `/`.
6. `pnpm test` → all unit tests green. `pnpm build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/invite components/invite-form.tsx app/session-expired .env.example .gitignore
git commit -m "Wire invitation acceptance and finalize env docs"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** Auth model (T3), page dispositions (T5/T6), schema (T2), onboarding (T7), email (T4), route protection + DAL (T3/T8), API keys (T9), invite (T10), env (T1/T10) — all spec sections covered. Social/SSO explicitly left unwired (Global Constraints).
- **Placeholder scan:** No TBDs; generated-schema note in T2 references a concrete CLI command with a hand-written baseline, not a placeholder.
- **Type consistency:** `requireActiveOrganization` returns `{ user, organization }` consistently in T8/T9. `apiKey` table fields (`hash`, `preview`, `scopes`, `revokedAt`, `expiresAt`) match the helpers in `lib/api-keys.ts` and the `ApiKey` type mapping in `toApiKey`. `slugify`/`isSlugValid` signatures match between `lib/slug.ts` and `onboarding-form.tsx`.
- **Refinement vs spec:** Org routing lives in the dashboard layout (DAL, DB-backed) rather than `proxy.ts` (cookie-only), per the Next.js auth guide's "no DB in proxy" rule — same user-facing behavior, more correct.
