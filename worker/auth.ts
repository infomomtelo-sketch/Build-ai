import type { Env } from "./env";
import { randomId, stamp, unstamp, hashToken } from "./crypto";
import {
  json,
  fail,
  redirect,
  readCookie,
  setCookie,
  clearCookie,
  clientIp,
} from "./http";
import { rateLimit } from "./ratelimit";
import { grantRole, isAllowlistedOwner } from "./roles";
import { createSession, destroySession, getViewer } from "./session";

const OAUTH_STATE_COOKIE = "jarvis_oauth_state";
const OAUTH_SCOPES = "read:user user:email";
const USER_AGENT = "jarvis-build-command";

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

function oauthConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.SESSION_SECRET);
}

function devLoginEnabled(env: Env): boolean {
  // Refuses to activate in production regardless of the flag.
  return env.ALLOW_DEV_LOGIN === "true" && env.ENVIRONMENT !== "production";
}

async function logAuthEvent(
  env: Env,
  request: Request,
  event: string,
  email: string | null,
  detail: string,
): Promise<void> {
  const secret = env.SESSION_SECRET ?? "unconfigured";
  await env.DB.prepare(
    "INSERT INTO auth_events (event, email, detail, ip_hash) VALUES (?1, ?2, ?3, ?4)",
  )
    .bind(event, email, detail, await hashToken(clientIp(request), secret))
    .run();
}

/** GET /api/auth/config — what the login screen needs, and nothing more. */
export function authConfig(env: Env): Response {
  return json({
    githubEnabled: oauthConfigured(env),
    devLoginEnabled: devLoginEnabled(env),
    environment: env.ENVIRONMENT ?? "unknown",
    // Deliberately absent: client id, allowlist, any secret material.
  });
}

/** GET /api/auth/github/start */
export async function githubStart(env: Env, request: Request): Promise<Response> {
  // Rate limit first: an unconfigured deployment should not be a free
  // unmetered endpoint either.
  const limit = await rateLimit(env, "auth_start", clientIp(request), 20, 300);
  if (!limit.allowed) {
    return fail(429, "rate_limited", "Too many sign-in attempts. Try again shortly.");
  }

  if (!oauthConfigured(env)) {
    return fail(
      503,
      "oauth_not_configured",
      "GitHub sign-in is not configured on this deployment.",
    );
  }

  const secret = env.SESSION_SECRET!;
  const state = randomId(24);
  const url = new URL(request.url);

  const headers = new Headers();
  setCookie(headers, OAUTH_STATE_COOKIE, await stamp(state, secret), {
    maxAge: 600,
    secure: url.protocol === "https:",
  });

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
  authorize.searchParams.set("redirect_uri", `${url.origin}/api/auth/github/callback`);
  authorize.searchParams.set("scope", OAUTH_SCOPES);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");

  return redirect(authorize.toString(), headers);
}

/** GET /api/auth/github/callback */
export async function githubCallback(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const headers = new Headers();
  clearCookie(headers, OAUTH_STATE_COOKIE, secure);

  const deny = (reason: string) => {
    const to = new URL("/login", url.origin);
    to.searchParams.set("error", reason);
    return redirect(to.toString(), headers);
  };

  if (!oauthConfigured(env)) return deny("oauth_not_configured");

  const limit = await rateLimit(env, "auth_callback", clientIp(request), 20, 300);
  if (!limit.allowed) return deny("rate_limited");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return deny("missing_code");

  const secret = env.SESSION_SECRET!;
  const cookieState = readCookie(request, OAUTH_STATE_COOKIE);
  const expectedState = cookieState ? await unstamp(cookieState, secret) : null;
  if (!expectedState || expectedState !== state) return deny("bad_state");

  // ── exchange code for a token; the token stays in this function ──────────
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/auth/github/callback`,
    }),
  });

  if (!tokenRes.ok) {
    await logAuthEvent(env, request, "login_denied", null, "token_exchange_failed");
    return deny("token_exchange_failed");
  }

  const tokenBody = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenBody.access_token;
  if (!accessToken) {
    await logAuthEvent(env, request, "login_denied", null, "no_access_token");
    return deny("token_exchange_failed");
  }

  const gh = async (path: string) =>
    fetch(`https://api.github.com${path}`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.github+json",
        "user-agent": USER_AGENT,
      },
    });

  const userRes = await gh("/user");
  if (!userRes.ok) return deny("github_user_failed");
  const ghUser = (await userRes.json()) as GithubUser;

  // Resolve a verified primary email — the allowlist is keyed on email, so an
  // unverified address must never be trusted.
  let email = ghUser.email;
  const emailsRes = await gh("/user/emails");
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as GithubEmail[];
    email = emails.find((e) => e.primary && e.verified)?.email
      ?? emails.find((e) => e.verified)?.email
      ?? null;
  }

  if (!email) {
    await logAuthEvent(env, request, "login_denied", null, "no_verified_email");
    return deny("no_verified_email");
  }

  // ── the owner gate ──────────────────────────────────────────────────────
  if (!isAllowlistedOwner(env, email)) {
    await logAuthEvent(env, request, "login_denied", email, "not_allowlisted");
    return deny("not_allowlisted");
  }

  const userId = await upsertProfile(env, {
    email,
    displayName: ghUser.name ?? ghUser.login,
    avatarUrl: ghUser.avatar_url,
    githubLogin: ghUser.login,
    githubId: ghUser.id,
  });

  await grantRole(env, userId, "owner");
  await createSession(env, request, userId, headers);
  await logAuthEvent(env, request, "login_ok", email, "github");

  // The GitHub access token is intentionally discarded here. Phase 3 will
  // store it encrypted in `integrations`, server-side only.
  return redirect(new URL("/", url.origin).toString(), headers);
}

/** POST /api/auth/dev-login — local development only. */
export async function devLogin(env: Env, request: Request): Promise<Response> {
  if (!devLoginEnabled(env)) {
    return fail(404, "not_found", "Not found.");
  }
  if (!env.SESSION_SECRET) {
    return fail(503, "not_configured", "SESSION_SECRET is not configured.");
  }

  const limit = await rateLimit(env, "auth_dev", clientIp(request), 20, 300);
  if (!limit.allowed) {
    return fail(429, "rate_limited", "Too many sign-in attempts. Try again shortly.");
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();

  // The allowlist applies identically here — dev login skips the OAuth round
  // trip, never the owner check.
  if (!isAllowlistedOwner(env, email)) {
    await logAuthEvent(env, request, "login_denied", email || null, "dev_not_allowlisted");
    return fail(403, "not_allowlisted", "That address is not on the owner allowlist.");
  }

  const headers = new Headers();
  const userId = await upsertProfile(env, {
    email,
    displayName: email.split("@")[0],
    avatarUrl: null,
    githubLogin: null,
    githubId: null,
  });

  await grantRole(env, userId, "owner");
  await createSession(env, request, userId, headers);
  await logAuthEvent(env, request, "login_ok", email, "dev");

  return json({ ok: true }, { headers });
}

/** POST /api/auth/logout */
export async function logout(env: Env, request: Request): Promise<Response> {
  const headers = new Headers();
  const viewer = await getViewer(env, request);
  await destroySession(env, request, headers);
  if (viewer) await logAuthEvent(env, request, "logout", viewer.email, "user_initiated");
  return json({ ok: true }, { headers });
}

async function upsertProfile(
  env: Env,
  p: {
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    githubLogin: string | null;
    githubId: number | null;
  },
): Promise<string> {
  const existing = await env.DB.prepare("SELECT id FROM profiles WHERE email = ?1")
    .bind(p.email)
    .first<{ id: string }>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE profiles
          SET display_name = COALESCE(?2, display_name),
              avatar_url   = COALESCE(?3, avatar_url),
              github_login = COALESCE(?4, github_login),
              github_id    = COALESCE(?5, github_id),
              last_seen_at = datetime('now')
        WHERE id = ?1`,
    )
      .bind(existing.id, p.displayName, p.avatarUrl, p.githubLogin, p.githubId)
      .run();
    return existing.id;
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO profiles (id, email, display_name, avatar_url, github_login, github_id, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))`,
  )
    .bind(id, p.email, p.displayName, p.avatarUrl, p.githubLogin, p.githubId)
    .run();
  return id;
}
