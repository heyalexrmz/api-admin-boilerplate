# Acme — API key management dashboard

A Next.js (App Router) app with email magic-link authentication, organizations,
API key management, and request logs. Built with Better Auth, Drizzle ORM,
PostgreSQL, Resend, and React Email.

## Stack

- **Auth:** [Better Auth](https://www.better-auth.com) — magic link + organization plugins
- **DB:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)
- **Email:** [Resend](https://resend.com) + [React Email](https://react.email)
- **UI:** [shadcn/ui](https://ui.shadcn.com) + Tailwind CSS v4
- **Tests:** [Vitest](https://vitest.dev)

## Getting started

### 1. Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io)
- Docker (for the local Postgres)

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Generate a Better Auth secret:

```bash
openssl rand -base64 32
```

In development you can leave `RESEND_API_KEY` as the placeholder — magic-link
URLs are logged to the dev server console so you can click them without a real
Resend key. Set a real key + verified sender for production email delivery.

### 4. Start the database

```bash
pnpm db:up      # starts Postgres 17 on localhost:5433
pnpm db:push    # creates/updates tables from the Drizzle schema
```

### 5. Run the app

```bash
pnpm dev        # http://localhost:3000
```

Enter your email on the sign-in page, then click the magic link printed in the
server console (or emailed by Resend in production). First-time users are sent
to `/onboarding` to create their workspace.

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
| `pnpm email:dev` | React Email preview server at http://localhost:3030 |

## Project layout

```
app/
  actions/          Server actions (auth, settings, api-keys, onboarding)
  api/auth/[...all] Better Auth catch-all route handler
  dashboard/        Protected app (overview, keys, logs, settings)
  onboarding/       Workspace creation for new users
  lib/auth.ts       Server DAL: session, user, active organization (cached)
lib/
  auth.ts           Better Auth server instance
  auth-client.ts    Better Auth React client
  db/               Drizzle schema + connection
  email/            Resend sender + magic-link email
  api-keys.ts       Pure API key helpers (tested)
  slugify.ts        Pure slug helper (tested)
emails/             React Email templates
proxy.ts            Optimistic route protection (cookie-only redirects)
```

## How auth works

- `proxy.ts` runs on every request and redirects based on the session cookie
  only (no DB hit): unauthed users hitting `/dashboard` or `/onboarding` go to
  `/`; authed users hitting `/` or `/signup` go to `/dashboard`.
- `app/lib/auth.ts` is the server Data Access Layer. `requireActiveOrganization`
  throws a redirect to `/onboarding` when an authed user has no workspace.
- API keys store only a SHA-256 hash and a masked preview; the plaintext secret
  is returned to the client exactly once on creation/rotation.
