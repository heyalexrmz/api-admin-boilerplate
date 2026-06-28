# Authentication & Organizations — Design

- **Date:** 2026-06-28
- **Status:** Approved (pending spec review)
- **Scope:** Replace the mock auth UI with a real authentication system using Better Auth (magic link), Resend + React Email for transactional email, PostgreSQL + Drizzle for persistence, and an organization onboarding step.

## Context

The repository is a Next.js 16.2.9 App Router app (React 19, Tailwind v4, shadcn) with a fully scaffolded but **mock** auth and dashboard UI. Server actions in `app/actions/auth.ts` and `app/actions/api-keys.ts` simulate work with `simulateNetworkDelay()` and `requireAuth()` stubs. Existing auth pages: `/` (login), `/signup`, `/forgot-password`, `/forgot-password/sent`, `/reset-password`, `/verify-email`, `/sso`, `/invite`, `/session-expired`. Existing dashboard: `/dashboard`, `/dashboard/keys`, `/dashboard/logs`, `/dashboard/settings`. The `ApiKey` and `RequestLog` types already exist in `app/lib/definitions.ts`.

Notably, this Next.js version uses **`proxy.ts`** (not `middleware.ts`) as the file convention for route-protection redirects, and its `cookies`/`cache` APIs are async. The bundled `authentication.md` guide is the source of truth for these conventions and lists Better Auth as a recommended library.

## Decisions (confirmed with user)

1. **Magic link only.** Passwords are removed. The password-related pages (`forgot-password`, `reset-password`, `verify-email`) are deleted; the `verify-email` 6-digit-code flow is obsolete because magic link verifies email ownership by clicking the link.
2. **Local DB via Docker Compose.** Both Docker (v29 + Compose v2.40) and Postgres.app are installed; Docker Compose is chosen for reproducibility.
3. **Better Auth `organization` plugin** for orgs/members/invitations/roles (Option A). Custom schema is limited to app-specific tables.
4. **API keys are org-owned**, not user-owned. Any admin in the org can manage them.
5. **Onboarding is a single screen** (organization name + auto-derived slug), not a multi-step wizard.
6. **Social/SSO is out of scope** for this pass; the Google/Microsoft buttons remain visually but are not wired to providers.

## Architecture

### Auth model

- **Better Auth** server instance at `lib/auth.ts` using the **Drizzle adapter** (`provider: "pg"`) and two plugins: `magicLink` and `organization`.
- **Magic link plugin** with a `sendMagicLink` callback that delegates to Resend (see Email).
- **Client** at `lib/auth-client.ts`: `createAuthClient` from `better-auth/react`, exposing `signIn.magicLink({ email })`, `useSession`, and `organization.*`.
- **Server DAL** at `app/lib/auth.ts` (`server-only`), memoized with React `cache`: `verifySession()` → `getUser()` → `getActiveOrganization()`. All server actions and data fetches go through the DAL so authorization is enforced next to the data, not only at the route boundary.
- Better Auth manages the core tables `user`, `session`, `account`, `verification`, and the org plugin manages `organization`, `member`, `invitation`. We add custom columns to `user` (`bio`, `timezone`) and hand-write `api_keys` and `request_logs`.

### Auth flow

1. User enters email on `/` (or `/signup`) and clicks **Send magic link**.
2. `signIn.magicLink({ email })` → Better Auth generates a token and calls `sendMagicLink`.
3. Resend delivers a React Email template containing the link.
4. User clicks the link → Better Auth verifies the token, creates the user if new (or updates `emailVerified`), creates a session, and redirects to `callbackURL`, which is `/`.
5. The `proxy.ts` route guard sees an authenticated user at `/` and inspects the user's organizations:
   - **No organizations** → redirect to `/onboarding`.
   - **One organization** → `organization.setActive` then redirect to `/dashboard`.
   - **Multiple organizations** → default to the first via `setActive` and go to `/dashboard` (a full org switcher is future polish).

### Existing auth pages — disposition

| Route | Action |
|---|---|
| `app/page.tsx` (login) | Replace `LoginForm` with `MagicLinkForm` (email + "Send magic link"); footer link to `/signup` |
| `app/signup/page.tsx` | Replace `SignupForm` with `MagicLinkForm` titled "Create your account" (same flow; user created on link click if new) |
| `app/forgot-password/`, `app/forgot-password/sent/`, `app/reset-password/`, `app/verify-email/` | Delete — password concepts, obsolete under magic link |
| `app/invite/page.tsx` | Rewire to real org-invitation acceptance via the organization plugin |
| `app/session-expired/page.tsx` | Keep; wire to real session expiry |
| `app/sso/page.tsx` | Leave as placeholder; social login out of scope |
| `components/login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `verify-email-form.tsx`, `resend-reset-email-button.tsx`, `reset-success-alert.tsx` | Replace or delete accordingly; password show/hide and 6-digit code logic removed |

The "or continue with Google / Microsoft" buttons stay in the UI but are not wired to real providers in this pass.

### Database & schema

**Infrastructure**

- `docker-compose.yml`: service `postgres` using image `postgres:17`, named volume for data, healthcheck (`pg_isready`), port `5432:5432`, database/user/password `demo`/`demo`/`demo` (local only). Started with `docker compose up -d`.
- `lib/db/index.ts`: `Pool` from `pg` configured from `DATABASE_URL`, passed to `drizzle({ pool, schema })` with the full schema for relational queries.
- `drizzle.config.ts`: `dialect: "postgresql"`, schema glob covering `lib/db/schema/*.ts`, `dbCredentials.url` from `DATABASE_URL`.
- **Scripts** in `package.json`:
  - `db:push` → `drizzle-kit push` (fast dev syncing)
  - `db:generate` → `drizzle-kit generate` (emit migration files)
  - `db:migrate` → `drizzle-kit migrate`
  - `db:studio` → `drizzle-kit studio`
  - `auth:generate` → `@better-auth/cli generate` (emit Better Auth Drizzle tables)
  - `email dev` → `email dev` (React Email preview server)

**Schema** (`lib/db/schema/*.ts`)

- *Better Auth core (generated, committed):* `user` (id, name, email, emailVerified, image, createdAt, updatedAt, plus custom `bio` text, `timezone` text), `session`, `account`, `verification`.
- *Organization plugin (generated):* `organization` (id, name, slug unique, logo, createdAt, updatedAt), `member` (organizationId, userId, role, createdAt), `invitation` (organizationId, email, role, status, expiresAt, inviterId, createdAt).
- *Custom — `api_keys` (org-scoped):* `id` (uuid pk), `organizationId` (FK → organization, onDelete cascade), `createdByUserId` (FK → user), `name` (text), `hash` (text; sha-256 of the plaintext secret — the plaintext is never stored), `preview` (text; masked, e.g. `sk_live_••••••••1234`), `scopes` (`text[]`), `expiresAt` (timestamptz, nullable), `lastUsedAt` (timestamptz, nullable), `lastRotatedAt` (timestamptz, nullable), `revokedAt` (timestamptz, nullable), `createdAt` (timestamptz default now). Status (`active`/`revoked`/`expired`) is **derived** from `revokedAt` and `expiresAt`, not stored.
- *Custom — `request_logs` (org-scoped):* `id` (uuid pk), `organizationId` (FK → organization, cascade), `apiKeyId` (FK → api_keys, nullable for unauthenticated attempts), `requestId` (text), `timestamp` (timestamptz default now), `method` (`pgEnum` GET/POST/PUT/PATCH/DELETE), `path` (text), `status` (integer), `latencyMs` (integer), `ip` (text), `userAgent` (text), `requestHeaders` (jsonb), `requestBody` (text, nullable), `responseHeaders` (jsonb), `responseBody` (text, nullable).

This maps onto the existing `ApiKey` and `RequestLog` types in `app/lib/definitions.ts`. Only the schema is built for `request_logs` in this pass — no real ingestion pipeline.

### Onboarding

- New route `app/onboarding/page.tsx`, protected (signed-in only).
- **Form fields:** organization name (required), slug (auto-derived from name, live-editable, uniqueness-checked against the `organization` table), optional logo URL.
- **Submit:** `authClient.organization.create({ name, slug })` (creator receives the `owner` role), then `authClient.organization.setActive({ slug })`, then redirect to `/dashboard`.
- **Guards** (in `proxy.ts`): a signed-in user with no organization hitting `/dashboard/*` is redirected to `/onboarding`; a signed-in user **with** an organization hitting `/onboarding` is redirected to `/dashboard`.

### Email (Resend + React Email)

- `lib/email/resend.ts`: `new Resend(process.env.RESEND_API_KEY)` and a `sendEmail({ to, subject, react })` helper.
- `emails/magic-link.tsx`: React Email template rendering the magic-link URL with Acme brand styling. The only email template in this pass.
- React Email preview configured so `pnpm email dev` serves templates at `localhost:3000`.
- Wiring: `magicLink({ sendMagicLink: async ({ email, url }) => sendEmail({ to: email, subject: "Your Acme sign-in link", react: MagicLinkEmail({ url }) }) })`.
- `from` address: `Acme <onboarding@resend.dev>` for local dev (Resend sandbox sender), swappable to a verified domain via the `RESEND_FROM` env var.

### Route protection & DAL

- `proxy.ts` performs **optimistic** redirects only (reads the session cookie, no DB hits):
  - unauthenticated → `/dashboard/*` and `/onboarding` → `/`
  - authenticated → `/` and `/signup` → `/dashboard` (or `/onboarding` if no org)
  - matcher excludes `api`, `_next/static`, `_next/image`, and static assets.
- `app/lib/auth.ts` DAL: `verifySession()` calls Better Auth's `auth()`, `getUser()` returns the current user (DTO: id, name, email, image), `getActiveOrganization()` returns the active org (id, name, slug). All wrapped in React `cache` to dedupe per render pass.
- `app/actions/api-keys.ts` rewritten through the DAL: every action is scoped to the active organization; secrets are generated server-side, stored as sha-256 hash + masked preview only (plaintext returned exactly once on create/rotate, matching the existing `NewApiKey`/`RotatedApiKey` contracts). This realizes the TODO comments already in that file.

### Environment

- **`.env`** (gitignored) and **`.env.example`** (committed):
  - `DATABASE_URL` — e.g. `postgresql://demo:demo@localhost:5432/demo`
  - `BETTER_AUTH_SECRET` — generated via `openssl rand -base64 32`
  - `BETTER_AUTH_URL` — `http://localhost:3000` in dev
  - `RESEND_API_KEY` — from the Resend dashboard
  - `RESEND_FROM` — `Acme <onboarding@resend.dev>` (dev) or a verified domain
- **Packages to add:** `better-auth`, `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `resend`, `react-email`, `@react-email/components`, `@react-email/render`. The Drizzle adapter ships inside `better-auth` per the current install docs; the exact import path (`better-auth/adapters/drizzle` vs `@better-auth/drizzle-adapter`) will be confirmed against the installed version during planning.

### Better Auth API route

Better Auth needs a single catch-all route handler exposing its endpoints. In this App Router version that is `app/api/auth/[...all]/route.ts` exporting `GET` and `POST` via Better Auth's Next.js handler, mounted under `/api/auth/*`. The magic-link verification link points here.

## Out of scope (explicitly)

- Social/SSO providers (Google, Microsoft) — buttons remain, not wired.
- Two-factor / passkey authentication.
- Billing integration (the settings Billing tab stays UI-only).
- Real request-log ingestion pipeline — only the `request_logs` schema is built.
- A full organization switcher UI — multiple-org users default to their first org; a switcher is future polish.

## Risks & notes

- **Next.js version specifics:** `proxy.ts` (not `middleware.ts`), async `cookies()`, and React `cache` for DAL memoization are required by this version. The bundled docs are the source of truth.
- **Better Auth schema generation:** the `@better-auth/cli generate` command emits Drizzle table definitions for core + enabled plugins; these are committed and then extended with custom columns/tables. Regeneration is needed if plugin config changes.
- **Secrets handling:** API key plaintext is returned to the client exactly once (create/rotate) and never persisted; only the sha-256 hash and masked preview are stored, matching the existing `NewApiKey`/`RotatedApiKey` types.
