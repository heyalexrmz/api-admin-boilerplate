# Acme — API platform admin boilerplate

A production-ready Next.js admin dashboard for API-as-a-service products. Ship auth, multi-tenant organizations, API key management, request logging, webhooks, and team settings without rebuilding the same scaffolding.

Built for teams who want a polished operator console on day one — not a generic admin template with placeholder pages.

## What you get

### Authentication & onboarding

- **Passwordless sign-in** via email magic links ([Better Auth](https://www.better-auth.com))
- **Sign-up and login flows** with a shared auth shell and branded email templates
- **First-run onboarding** — new users create a workspace (organization name + slug) before entering the dashboard
- **Session management** — view and revoke active sessions from Settings → Security

### Multi-tenant organizations

- **Workspaces** with slug-based identifiers and an org switcher in the sidebar
- **Roles** — `owner`, `admin`, and `member` with manager-only routes for sensitive areas
- **Team invitations** — invite by email with role selection; accept flow wired to magic-link auth
- **Organization settings** — rename workspace, manage members, cancel pending invites

### API keys

- Create, rename, rotate, and revoke keys scoped to the active organization
- Secrets stored as **SHA-256 hashes** with masked previews — plaintext shown only once on create/rotate
- Manager-only access to the keys page

### Request logs

- Every call to the sample `/api/ping` endpoint is persisted with method, status, latency, IP, user agent, and redacted headers/bodies
- Filterable logs table with date range, status, method, and search
- Sensitive values redacted before storage

### Webhooks

- Register HTTPS endpoints subscribed to event types
- **HMAC-signed deliveries** with signing secrets (rotate anytime)
- Delivery logs with status, HTTP response, latency, and payload inspection
- Send test events from the dashboard
- URL policy validation blocks private/reserved hosts in production

### Overview dashboard

- 24-hour stats: request volume, active keys, error rate, average latency
- Time-series charts for request volume and latency (hourly or daily granularity)
- Status mix breakdown (2xx / 4xx / 5xx)

### Settings

| Tab | Purpose |
| --- | --- |
| Account | Profile, timezone, bio |
| Organization | Workspace details, team members, invitations |
| Notifications | Email alert preferences (UI scaffold) |
| Billing | Plan and usage (UI scaffold) |
| Security | Sessions, sign-out everywhere |
| Appearance | Light / dark / system theme |

## Stack

| Layer | Choice |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) App Router, React 19 |
| Auth | [Better Auth](https://www.better-auth.com) — magic link + organization plugins |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Email | [Resend](https://resend.com) + [React Email](https://react.email) |
| UI | [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS v4 |
| Charts | [Recharts](https://recharts.org) |
| Tests | [Vitest](https://vitest.dev) |

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io)
- Docker (local Postgres)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate a Better Auth secret:

```bash
openssl rand -base64 32
```

Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` in `.env`.

In development you can leave `RESEND_API_KEY` as the placeholder — magic-link URLs are logged to the dev server console so you can click them without a real Resend key. Use a verified sender and real API key in production.

### 3. Start the database

```bash
pnpm db:up      # Postgres 17 on localhost:5433
pnpm db:push    # sync Drizzle schema to the database
```

### 4. Run the app

```bash
pnpm dev        # http://localhost:3000
```

Sign in with your email, click the magic link from the server console (or your inbox in production), and complete onboarding to create your first workspace.

### 5. Try the API

Create an API key in **Dashboard → API Keys**, then:

```bash
curl -H "Authorization: Bearer YOUR_KEY" http://localhost:3000/api/ping
```

POST with a JSON body to echo payload; add `?error=true` or `"simulate_error": true` in the body to generate 500s for testing logs and charts.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm test` / `pnpm test:watch` | Vitest unit tests |
| `pnpm db:up` | Start local Postgres via Docker Compose |
| `pnpm db:push` | Push schema changes to the database |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:generate` / `pnpm db:migrate` | Generate and apply migrations |
| `pnpm email:dev` | React Email preview at http://localhost:3030 |

## Project layout

```
app/
  actions/              Server actions (auth, keys, logs, webhooks, settings, org)
  api/
    auth/[...all]         Better Auth catch-all handler
    ping/                 Sample authenticated API route (writes request logs)
  dashboard/              Protected app shell
    page.tsx              Overview with charts and stats
    keys/                 API key management
    logs/                 Request log explorer
    webhooks/             Webhook CRUD + delivery logs
    settings/             Account, org, billing, security tabs
  invite/                 Team invitation acceptance
  onboarding/             Workspace creation for new users
  lib/auth.ts             Server DAL: session, user, active org (React cache)
components/               UI: sidebar, charts, tables, dialogs, settings tabs
emails/                   React Email templates (magic link, invitation)
lib/
  auth.ts                 Better Auth server instance
  auth-client.ts          Better Auth React client
  db/                     Drizzle schema + connection
  email/                  Resend sender
  api-auth.ts             Bearer token authentication for API routes
  webhook-dispatch.ts     Signed webhook delivery + logging
proxy.ts                  Cookie-only route protection (no DB on edge)
```

## Architecture notes

### Route protection

`proxy.ts` runs on every request and redirects based on the session cookie only — no database hit at the edge. Unauthenticated users hitting `/dashboard` or `/onboarding` go to `/`; authenticated users hitting `/` or `/signup` go to `/dashboard`.

### Server data layer

`app/lib/auth.ts` is the server Data Access Layer. `requireActiveOrganization()` redirects to `/onboarding` when an authenticated user has no workspace. Organization context flows from the session's `activeOrganizationId`.

### Role-based UI

Sidebar items marked `managerOnly` (API Keys, Logs, Webhooks) are hidden from members. Server actions enforce the same checks — the UI is not the security boundary.

### API key security

Keys are generated with a readable prefix, hashed with SHA-256 for lookup, and only the masked suffix is stored for display. The full secret is returned to the client exactly once on creation or rotation.

### Request log redaction

Headers and bodies pass through redaction helpers before persistence. Response bodies for successful requests are omitted to keep rows lean; error responses are capped at 8 KiB.

## Customization

This boilerplate uses **Acme** as placeholder branding. Search for `Acme` across `app/`, `components/`, and `emails/` to rename for your product. Update `RESEND_FROM` in `.env` to match your verified sender domain.

## License

MIT
