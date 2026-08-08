#!/usr/bin/env bash
#
# JARVIS — one-command Cloudflare setup.
#
#   ./scripts/setup.sh
#
# Creates the D1 database, wires its id into wrangler.jsonc, applies migrations,
# sets the Worker secrets, builds, deploys, and verifies the result.
#
# Safe to re-run: every step checks current state first. Nothing is destroyed,
# and an existing SESSION_SECRET is never rotated unless you ask for it with
# --rotate-session-secret (rotating forces a re-login).
#
# Values may be supplied as environment variables to run without prompts:
#   OWNER_EMAILS, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

DB_NAME="jarvis"
WORKER_NAME="jarvis-build-command"
CONFIG="wrangler.jsonc"
ROTATE_SESSION_SECRET=0

for arg in "$@"; do
  case "$arg" in
    --rotate-session-secret) ROTATE_SESSION_SECRET=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

# ── output helpers ──────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; CYAN=$'\033[36m'; RED=$'\033[31m'
  GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; CYAN=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

step()  { printf "\n%s▸ %s%s\n" "$BOLD$CYAN" "$1" "$RESET"; }
ok()    { printf "  %s✓%s %s\n" "$GREEN" "$RESET" "$1"; }
info()  { printf "  %s%s%s\n" "$DIM" "$1" "$RESET"; }
warn()  { printf "  %s!%s %s\n" "$YELLOW" "$RESET" "$1"; }
die()   { printf "\n%s✗ %s%s\n" "$RED" "$1" "$RESET" >&2; exit 1; }

wr() { npx --no-install wrangler "$@"; }

# ── 0. preflight ────────────────────────────────────────────────────────────
step "Preflight"

[ -f "$CONFIG" ] || die "$CONFIG not found — run this from the repo root."
[ -d node_modules ] || die "Dependencies missing. Run: npm install"

# `wrangler whoami` exits 0 even when unauthenticated, so inspect the output.
WHOAMI="$(wr whoami 2>&1 || true)"
if printf '%s' "$WHOAMI" | grep -qiE 'not authenticated|necessary to set a CLOUDFLARE_API_TOKEN'; then
  die "wrangler is not authenticated.
    Interactive:     npx wrangler login
    Non-interactive: export CLOUDFLARE_API_TOKEN=…  (needs D1:Edit + Workers Scripts:Edit)"
fi

ACCOUNT="$(printf '%s' "$WHOAMI" | grep -oE '[0-9a-f]{32}' | head -1 || true)"
ok "Authenticated${ACCOUNT:+ (account ${ACCOUNT:0:8}…)}"

# ── 1. D1 database ──────────────────────────────────────────────────────────
step "D1 database"

db_uuid() {
  wr d1 list --json 2>/dev/null \
    | node -e '
        let s="";
        process.stdin.on("data", c => s += c);
        process.stdin.on("end", () => {
          try {
            const list = JSON.parse(s.slice(s.indexOf("[")));
            const hit = list.find(d => d.name === process.argv[1]);
            if (hit) process.stdout.write(hit.uuid ?? hit.database_id ?? "");
          } catch { /* no databases yet, or unparseable output */ }
        });
      ' "$DB_NAME"
}

UUID="$(db_uuid || true)"

if [ -z "$UUID" ]; then
  info "Creating database \"$DB_NAME\"…"
  wr d1 create "$DB_NAME" >/dev/null || die "Could not create the D1 database."
  UUID="$(db_uuid || true)"
  [ -n "$UUID" ] || die "Database created but its id could not be read. Run: npx wrangler d1 list"
  ok "Created \"$DB_NAME\" ($UUID)"
else
  ok "Database \"$DB_NAME\" already exists ($UUID)"
fi

# ── 2. wire the id into wrangler.jsonc ──────────────────────────────────────
step "Configuration"

CURRENT_ID="$(grep -oE '"database_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG" \
  | head -1 | sed -E 's/.*"([^"]*)"$/\1/' || true)"

if [ "$CURRENT_ID" = "$UUID" ]; then
  ok "database_id already set"
else
  UUID="$UUID" node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const src = fs.readFileSync(path, "utf8");
    const out = src.replace(
      /("database_id"\s*:\s*")[^"]*(")/,
      (_m, a, b) => a + process.env.UUID + b,
    );
    if (out === src) {
      console.error("could not locate database_id in " + path);
      process.exit(1);
    }
    fs.writeFileSync(path, out);
  ' "$CONFIG" || die "Failed to patch $CONFIG."
  ok "Wrote database_id into $CONFIG"
  warn "Commit that change so future deploys use the same database."
fi

# ── 3. migrations ───────────────────────────────────────────────────────────
step "Migrations"
info "Applying to the remote database…"
wr d1 migrations apply "$DB_NAME" --remote || die "Migrations failed."
ok "Schema up to date"

# ── 4. secrets ──────────────────────────────────────────────────────────────
step "Secrets"

existing_secrets() {
  wr secret list --name "$WORKER_NAME" --format json 2>/dev/null \
    | node -e '
        let s="";
        process.stdin.on("data", c => s += c);
        process.stdin.on("end", () => {
          try {
            const list = JSON.parse(s.slice(s.indexOf("[")));
            process.stdout.write(list.map(x => x.name).join(" "));
          } catch { /* worker not deployed yet — no secrets to list */ }
        });
      ' || true
}

EXISTING="$(existing_secrets || true)"
has_secret() { [[ " $EXISTING " == *" $1 "* ]]; }

put_secret() { # name, value
  printf '%s' "$2" | wr secret put "$1" --name "$WORKER_NAME" >/dev/null \
    || die "Failed to set $1."
  ok "$1 set"
}

prompt_secret() { # name, description, is_hidden
  local name="$1" desc="$2" hidden="$3" value="${!1:-}"

  if [ -n "$value" ]; then
    put_secret "$name" "$value"
    return
  fi

  if [ ! -t 0 ]; then
    die "$name not set and no terminal to prompt on. Re-run interactively, or export $name."
  fi

  while [ -z "$value" ]; do
    if [ "$hidden" = "1" ]; then
      read -rsp "  $desc: " value; echo
    else
      read -rp "  $desc: " value
    fi
    [ -n "$value" ] || warn "Cannot be empty."
  done

  put_secret "$name" "$value"
}

# SESSION_SECRET is generated, never typed. Rotating it invalidates live
# sessions, so an existing one is left alone unless explicitly requested.
if has_secret SESSION_SECRET && [ "$ROTATE_SESSION_SECRET" -eq 0 ]; then
  ok "SESSION_SECRET already set (use --rotate-session-secret to replace)"
else
  put_secret SESSION_SECRET "$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
fi

prompt_secret OWNER_EMAILS         "Owner email(s), comma-separated" 0
prompt_secret GITHUB_CLIENT_ID     "GitHub OAuth client id"          0
prompt_secret GITHUB_CLIENT_SECRET "GitHub OAuth client secret"      1

# ── 5. build & deploy ───────────────────────────────────────────────────────
step "Build"
npm run build >/dev/null || die "Build failed. Run: npm run build"
ok "Client bundled to dist/client"

step "Deploy"
DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$DEPLOY_LOG"' EXIT
set +e
wr deploy 2>&1 | tee "$DEPLOY_LOG"
DEPLOY_STATUS=${PIPESTATUS[0]}
set -e
[ "$DEPLOY_STATUS" -eq 0 ] || die "Deploy failed — see the output above."

URL="$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | head -1 || true)"
URL="${URL:-https://$WORKER_NAME.workers.dev}"
ok "Deployed"

# ── 6. verify ───────────────────────────────────────────────────────────────
step "Verify"

HEALTH="$(curl -fsS --max-time 20 "$URL/api/health" 2>/dev/null || true)"
if [[ "$HEALTH" == *'"ok":true'* ]]; then
  ok "Health check passed — $HEALTH"
else
  warn "Health check did not respond yet. Cold starts can take a few seconds."
  info "Retry: curl $URL/api/health"
fi

CONF="$(curl -fsS --max-time 20 "$URL/api/auth/config" 2>/dev/null || true)"
if [[ "$CONF" == *'"githubEnabled":true'* ]]; then
  ok "GitHub sign-in is configured"
elif [ -n "$CONF" ]; then
  warn "GitHub sign-in still reports unconfigured: $CONF"
fi

if [[ "$CONF" == *'"devLoginEnabled":true'* ]]; then
  die "dev login is ENABLED in production. Remove ALLOW_DEV_LOGIN and redeploy."
else
  ok "Dev login is off in production"
fi

# ── done ────────────────────────────────────────────────────────────────────
printf "\n%sJARVIS is live.%s\n\n" "$BOLD$GREEN" "$RESET"
printf "  Console   %s\n" "$URL"
printf "  Callback  %s/api/auth/github/callback\n\n" "$URL"
printf "%sThat callback URL must match your GitHub OAuth app exactly,%s\n" "$DIM" "$RESET"
printf "%sotherwise sign-in fails with a redirect_uri mismatch.%s\n\n" "$DIM" "$RESET"
