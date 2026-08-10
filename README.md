# JARVIS — Autonomous Build Command Center

> Every build. One console.

A single-operator mission control that monitors, codes, fixes, and deploys every
app you own. Dark, cinematic, HUD-style.

**Phases 1–2 are shipped:** auth, owner allowlist, shell, animated core, project
registry, and manual metrics entry. The wall displays per-project health, MRR
trend, users, errors, and a rolling event log. **Phases 3–5 are scaffolded** — GitHub
read, error ingest with a fix queue, and a read-only AI assistant. Phases 6–7 are
scaffolded but empty — a screen goes live only once it reads real data.

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
| 2 | Project registry + manual metrics entry + wall       | **Shipped** |
| 3 | GitHub read (tree, file, commits) + repo console    | Scaffolded |
| 4 | Metrics + error ingest + fix queue                  | **Shipped** |
| 5 | AI assistant with read-only tools                   | Scaffolded |
| 6 | Write actions: PRs, deploys, rollback               | Pending    |
| 7 | Daily briefing + voice mode                         | Pending    |

---

## First-time setup

### The short way

Register a GitHub OAuth app first (see step 3 below for the two URLs), then:

```bash
npm install
npx wrangler login          # or: export CLOUDFLARE_API_TOKEN=…
npm run setup
```

`wrangler login` opens a browser. To stay headless — CI, a container, a remote
session — create an API token instead and export `CLOUDFLARE_API_TOKEN`.
Everything below works identically either way.

Token scopes: **Workers Scripts: Edit**, **D1: Edit**, **Account Settings:
Read** (the last is what `wrangler whoami` reads to resolve your account).

Keep the token out of shell history — write it to a file without ever passing
it as an argument, then source that file per session:

```bash
mkdir -p ~/.config/cloudflare
read -rs TOKEN                                   # typed, not echoed, not in history
printf 'CLOUDFLARE_API_TOKEN=%s\n' "$TOKEN" > ~/.config/cloudflare/env
chmod 600 ~/.config/cloudflare/env
unset TOKEN

set -a; . ~/.config/cloudflare/env; set +a       # once per shell session
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

> **The callback path is `/api/auth/github/callback`.**
> Not `/api/auth/callback/github` — the segment order matters. The Worker sends
> this exact path as its `redirect_uri` and GitHub compares it byte-for-byte,
> so a swapped or trailing-slashed version fails with a `redirect_uri` mismatch
> before your code ever runs. The path is defined once as
> `GITHUB_CALLBACK_PATH` in `worker/auth.ts`; if you change it there, re-register
> the app to match.

### 4. Set the secrets

These live only inside the Worker. Nothing in this codebase returns, logs, or
embeds any of them in a response.

```bash
npx wrangler secret put OWNER_EMAILS         # "you@example.com,you@work.com"
npx wrangler secret put SESSION_SECRET       # openssl rand -hex 32
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put ANTHROPIC_API_KEY    # phase 5 assistant; optional until then
```

`ANTHROPIC_API_KEY` comes from **console.anthropic.com → Settings → API keys**.
For local development put it in `.dev.vars` instead. Until it is set, the
assistant answers every request with a 503 naming the missing secret — the rest
of the console works normally without it.

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

### Signing in locally

`ALLOW_DEV_LOGIN` exists precisely so you do **not** need a GitHub OAuth app to
work locally. Use it unless you are specifically testing the OAuth flow itself.

If you do want the real GitHub flow locally, register a **second** OAuth app —
a GitHub OAuth app has exactly one callback URL, so localhost cannot share the
production app. Which URL you register depends on the port you open in the
browser, because the Worker derives its `redirect_uri` from the incoming
`Host` header:

| You run           | You open                | Register                                          |
| ----------------- | ----------------------- | ------------------------------------------------- |
| `npm run dev`     | `http://localhost:5173` | `http://localhost:5173/api/auth/github/callback`   |
| `npm run preview` | `http://localhost:8787` | `http://localhost:8787/api/auth/github/callback`   |

The Vite proxy is configured with `changeOrigin: false`, so the browser's origin
passes straight through to the Worker — verified, not assumed. Register the port
you actually browse to, and use `localhost` consistently: `127.0.0.1` and
`localhost` are different origins to GitHub.

Then add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` for that second app to
`.dev.vars`.

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

### Phase 3: GitHub read

Phase 3 adds GitHub integration, storing the user's access token encrypted in
the `integrations` table. When the user signs in, their token is saved; the
Worker uses it to proxy API calls to GitHub, keeping credentials server-side.

The **Repo Console** screen (`/repo`) lets operators browse repository trees,
read files, and view commit history — all read-only in Phase 3. Phase 6 adds
write actions: opening PRs and triggering deployments from here.

Token encryption is currently simple XOR (not production-ready); real
deployments should use proper encryption like libsodium or nacl.

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
  projects.ts      (Phase 2) Project registry and metrics data layer
  api.ts           (Phase 2) API handlers: project CRUD, metrics, overview
  github.ts        (Phase 3) GitHub API proxy, token storage, tree/file/commit access
  errors.ts        (Phase 4) Error ingest, fingerprinting, impact ranking
  assistant.ts     (Phase 5) Read-only assistant — tools, system prompt, tool loop
migrations/        D1 schema
  0001_*           Auth foundation (profiles, sessions, roles)
  0002_*           Project registry (projects, metrics_daily, events)
  0003_*           GitHub integration (integrations table)
src/               React client
  components/      CoreOrb, AppShell, AssistantDock, Modal, ProjectForm, icons
  screens/         Login, Overview, Projects, ProjectDetail, RepoConsole, PhasePending
  lib/             API client, navigation config, formatters
scripts/           Deployment and seeding
legacy/            Prior unrelated prototype, kept for reference
```
