# JARVIS — Autonomous Build Command Center

> Every build. One console.

A single-operator mission control that monitors, codes, fixes, and deploys every
app you own. Dark, cinematic, HUD-style.

**Phase 1 is shipped:** auth, server-side owner allowlist, the shell layout, and
the animated core. Phases 2–7 are scaffolded but deliberately empty — a screen
goes live only once it reads real data.

---

## Stack

| Layer    | Choice                                                    |
| -------- | --------------------------------------------------------- |
| Runtime  | Cloudflare Workers (`jarvis-build-command`)               |
| Database | Cloudflare D1 (SQLite)                                    |
| UI       | React 19 + Vite, hand-written CSS (no utility framework)  |
| Auth     | GitHub OAuth → signed, HttpOnly, server-side session      |

---

## Phase status

| # | Scope                                              | State      |
| - | -------------------------------------------------- | ---------- |
| 1 | Auth + owner allowlist + shell + animated core      | **Shipped** |
| 2 | Project registry + manual metrics entry             | Pending    |
| 3 | GitHub read (tree, file, commits) + repo console    | Pending    |
| 4 | Metrics + error ingest + fix queue                  | Pending    |
| 5 | AI assistant with read-only tools                   | Pending    |
| 6 | Write actions: PRs, deploys, rollback               | Pending    |
| 7 | Daily briefing + voice mode                         | Pending    |

---

## First-time setup

### The short way

Register a GitHub OAuth app first (see step 3 below for the two URLs), then:

```bash
npm install
npx wrangler login
npm run setup
```

`npm run setup` creates the D1 database, writes its id into `wrangler.jsonc`,
applies migrations, generates `SESSION_SECRET`, prompts for the remaining
secrets, builds, deploys, and verifies the result — including asserting that dev
login is off in production.

It is safe to re-run. Every step checks current state first, and an existing
`SESSION_SECRET` is never rotated unless you pass `--rotate-session-secret`.
To run it unattended, export `OWNER_EMAILS`, `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` instead of answering prompts.

Commit the `wrangler.jsonc` change it makes, so later deploys reuse the same
database.

### The manual way

### 1. Create the database

```bash
npx wrangler d1 create jarvis
```

Copy the printed `database_id` into `wrangler.jsonc`, replacing
`REPLACE_WITH_D1_DATABASE_ID`.

### 2. Apply migrations

```bash
npm run db:migrate          # remote (production)
npm run db:migrate:local    # local dev
```

### 3. Register the GitHub OAuth app

Create one at <https://github.com/settings/developers>:

- **Homepage URL** — `https://jarvis-build-command.infomomtelo.workers.dev`
- **Authorization callback URL** —
  `https://jarvis-build-command.infomomtelo.workers.dev/api/auth/github/callback`

### 4. Set the secrets

These live only inside the Worker. Nothing in this codebase returns, logs, or
embeds any of them in a response.

```bash
npx wrangler secret put OWNER_EMAILS         # "you@example.com,you@work.com"
npx wrangler secret put SESSION_SECRET       # openssl rand -hex 32
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

### 5. Deploy

```bash
npm run deploy
```

---

## Local development

Create `.dev.vars` (gitignored):

```
ENVIRONMENT=development
ALLOW_DEV_LOGIN=true
OWNER_EMAILS=you@example.com
SESSION_SECRET=any-long-random-string-for-local-only
```

Then, in two terminals:

```bash
npm run dev:api    # Worker + local D1 on :8787
npm run dev        # UI on :5173, proxying /api to :8787
```

`ALLOW_DEV_LOGIN` skips the OAuth round trip but **not** the owner allowlist —
a non-allowlisted address is refused locally exactly as it is in production. It
is double-gated: the flag must be `true` *and* `ENVIRONMENT` must not be
`production`, so it cannot activate on the deployed Worker.

Useful commands:

```bash
npm run typecheck   # client + worker
npm run build       # vite build → dist/client
npm run preview     # build, then serve the real Worker locally
```

---

## Security model

The brief specified Postgres RLS and a `has_role()` SECURITY DEFINER function.
D1/SQLite has neither row-level security nor stored functions, so the guarantee
is provided differently — and the difference favours this design in one respect:
**the browser holds no database credential and cannot issue SQL at all.** Every
read and write goes through the Worker.

The structural requirements carry over exactly:

- **Roles live in their own table.** `user_roles`, keyed `(user_id, role)`.
  `profiles` has no `role` column, by design.
- **Role checks are a single function.** Every authorization decision goes
  through `hasRole()` in `worker/roles.ts`. No caller compares role strings
  inline.
- **The owner allowlist is server-side only.** `OWNER_EMAILS` is a Worker
  secret, read in `worker/roles.ts`, and never serialized into any response —
  it cannot reach client code or localStorage. `/api/auth/config` returns
  booleans only.
- **Sessions are opaque and revocable.** The cookie carries a random id plus an
  HMAC-SHA256 signature — no identity data, nothing forgeable. Session records
  live in D1, so deleting a row revokes access immediately. Cookies are
  `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS. Unparseable expiry
  timestamps fail closed.
- **Default deny.** Every `/api/*` route not on the public list requires an
  authenticated viewer holding the `owner` role.
- **Provider tokens never reach the browser.** The GitHub access token is used
  inside the callback and discarded. Phase 3 stores it encrypted in
  `integrations`, server-side only.
- **Rate limiting.** D1-backed fixed-window limiter on the auth endpoints
  (20 / 5 min per IP), reused for AI and deploy actions in phases 5–6.
- **Audit trail.** `auth_events` records every authentication decision,
  including denials. IP addresses are stored only as salted hashes.

---

## Design tokens

Every colour resolves to a semantic token in `src/index.css`. Components never
hardcode a hex value or a colour utility class. The raw palette block at the top
of that file is the only place literal colour values appear.

| Token              | Role                        |
| ------------------ | --------------------------- |
| `--surface-void`   | Base — deep space navy      |
| `--accent`         | Primary — electric cyan     |
| `--status-warn`    | Warnings — amber            |
| `--status-critical`| Incidents — red             |

Typography: **Space Grotesk** for headings, **JetBrains Mono** for telemetry.

### The core

`src/components/CoreOrb.tsx` is the centrepiece — an SVG + CSS radial core that
pulses faster as activity rises (4.2s at rest → 0.9s saturated) with one
orbiting dot per connected repo, coloured by health. It reads from `/api/core`,
which returns an empty node list until the phase 2 project registry fills it.
All motion is CSS-driven, so `prefers-reduced-motion` is honoured.

---

## Layout

```
worker/            Cloudflare Worker — API, auth, authorization
  index.ts         Route table and the default-deny gate
  auth.ts          GitHub OAuth, owner allowlist, dev login
  session.ts       Signed cookie ↔ D1 session records
  roles.ts         hasRole() — the single authorization chokepoint
  ratelimit.ts     D1 fixed-window limiter
  crypto.ts        HMAC signing, opaque ids, IP hashing
migrations/        D1 schema
src/               React client
  components/      CoreOrb, AppShell, AssistantDock, icons
  screens/         Login, Overview, PhasePending
  lib/             API client, navigation config
legacy/            Prior unrelated prototype, kept for reference
```
