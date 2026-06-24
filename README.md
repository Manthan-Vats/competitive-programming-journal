# cp-journal

A multi-tenant, invite-only competitive-programming journal and portfolio. Each invited user
captures problems (manually or via the
[Competitive Companion](https://github.com/jmerle/competitive-companion) browser extension),
attaches solutions, times attempts, optionally gets AI tags per solution, and publishes a
curated public portfolio at `/u/<handle>`. Data is **private by default** and per-user; a
single **operator** runs the instance and approves who gets in.

## Stack

- **Next.js** (App Router) + React + TypeScript
- **Supabase** - Postgres, Auth (email/password), Row Level Security
- **Google Gemini** - optional AI analysis of solution code (degrades cleanly if unset)
- Tailwind CSS, with light CSS/GSAP motion for the paper-themed UI

## Security model (read this before deploying)

The browser uses the Supabase **anon key**, which is public by design - so the **entire
security boundary is Postgres Row Level Security**. The model is per-user multi-tenancy:

- **Every row is owned** by a `user_id`. RLS lets a user do anything to their own rows
  (`own_rows`: `(select auth.uid()) = user_id`) and lets anyone read rows the owner has
  explicitly published (`public_read`: `is_public` / `is_public_code`). Auth for data lives
  entirely in the database - see `supabase/migrations/002_multitenant.sql`.
- **Private by default.** New problems/solutions are unpublished until their owner toggles
  them public.
- **Invite-only.** Public sign-ups are disabled in the dashboard; the only way in is a
  Supabase invite. Visitors submit a **Request access** form (`/api/access-requests`); the
  operator approves it from `/admin/invites`, which calls `inviteUserByEmail()`.
- **The operator** is the one elevated role (pinned via `OWNER_USER_ID`). It gates the invite
  surface only (`/admin/invites`, `POST /api/invites`).
  Fails closed: if unset, the invite surface is denied (per-user journals still work).
- The **service-role key bypasses RLS** - server-only, never `NEXT_PUBLIC_`, never sent to
  the client.
- **Browser-extension capture** is per-user: the extension mints a revocable bearer token at
  `/extension/connect` and posts to `/api/ext/*`. (The legacy shared-secret `/api/companion`
  ingest route has been removed.)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create the operator user first** in the Supabase dashboard -> Authentication -> Users ->
   Add User (use "Auto Confirm"). Copy its **User UID** - you'll need it for `OWNER_USER_ID`.
   This is the account whose rows existing data is backfilled to.

3. **Run the migrations** (SQL editor, in order):
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_multitenant.sql` - adds per-user ownership + RLS, makes data
     private by default, and creates the `access_requests` table. It backfills existing rows
     to the earliest-created auth user (the operator); read the header comment first.

4. **Configure environment.** Copy the template and fill in real values:
   ```bash
   cp .env.example .env.local
   ```
   Set `OWNER_USER_ID` to the operator UID from step 2. `.env.local` is gitignored.

5. **Disable public sign-ups** (Authentication -> Sign In / Providers -> Email -> turn off
   "Allow new users to sign up") and configure the invite email redirect to point at
   `/auth/confirm`. Access is then invite-only.

6. **Run it**
   ```bash
   npm run dev      # http://localhost:3000  (admin at /admin, login at /login)
   npm run build    # production build
   ```

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL. Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key (protected by RLS). Safe to expose. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server-only. Bypasses RLS. Never expose.** |
| `OWNER_USER_ID` | yes | The **operator's** Supabase auth user id. Gates the invite surface. Fails closed if unset. |
| `AI_KEY_ENC_SECRET` | yes (prod) | Master key (32 bytes, base64 - `openssl rand -base64 32`) that encrypts each user's stored Gemini key at rest. Held only here, never in the DB. Rotating it invalidates all stored user keys. |
| `GEMINI_API_KEY` | no (dev only) | Ignored in production - AI is **BYOK** (each user adds their own key in Settings). Used only as a local-dev fallback when `NODE_ENV != production`. |
| `NEXT_PUBLIC_APP_URL` | yes | Base URL used by internal API redirects. |

> If a key is ever committed or surfaced, **rotate it** in the Supabase dashboard
> (Project Settings -> API) and update `.env.local`.

## Deploy

Deploy to any Next.js host (e.g. Vercel). Set all the env vars above in the host's project
settings - do **not** ship `.env.local`. Run the migrations in `supabase/migrations/` against your
production Supabase project (including `016_user_ai_keys.sql`), set `AI_KEY_ENC_SECRET`, confirm
public sign-ups are disabled and the invite redirect points at `/auth/confirm`, and verify that a
logged-out visitor sees only published problems while an invited user can reach their own `/admin`.
Each user enables AI by pasting their own free Gemini key in Settings (BYOK).

## Project layout

- `app/` - App Router pages + API routes (`app/api/**`); public portfolios at `/` (operator)
  and `/u/<handle>`; invite acceptance at `/auth/confirm` -> `/auth/set-password`
- `lib/` - Supabase clients, Gemini, the `isOperator` auth helper (`lib/auth/operator.ts`),
  public-portfolio shaping (`lib/portfolio.ts`)
- `supabase/migrations/` - schema + per-user RLS policies (`002_multitenant.sql`)
- `extension/` - the cross-browser capture companion (see `extension/README.md`)
