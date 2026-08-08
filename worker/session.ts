import type { Env } from "./env";
import { randomId, stamp, unstamp, hashToken } from "./crypto";
import { readCookie, setCookie, clearCookie, clientIp } from "./http";
import { rolesFor, type Role } from "./roles";

export const SESSION_COOKIE = "jarvis_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export interface Viewer {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubLogin: string | null;
  roles: Role[];
}

function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

/**
 * Accepts both ISO-8601 (`2026-08-08T14:17:12.271Z`, what we write) and
 * SQLite's `datetime('now')` form (`2026-08-08 14:17:12`, always UTC).
 * Returns NaN for anything else so callers can fail closed.
 */
export function parseUtc(value: string): number {
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return Date.parse(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
}

export async function createSession(
  env: Env,
  request: Request,
  userId: string,
  headers: Headers,
): Promise<void> {
  const secret = requireSecret(env);
  const id = randomId(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, user_agent, ip_hash)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(
      id,
      userId,
      expiresAt,
      (request.headers.get("user-agent") ?? "").slice(0, 255),
      await hashToken(clientIp(request), secret),
    )
    .run();

  setCookie(headers, SESSION_COOKIE, await stamp(id, secret), {
    maxAge: SESSION_TTL_SECONDS,
    secure: isSecureRequest(request),
  });
}

/**
 * Resolves the current viewer from the signed session cookie. Returns null for
 * a missing, tampered, unknown, or expired session. The cookie itself carries
 * no identity data — only an opaque id — so nothing about the user is
 * forgeable client-side.
 */
export async function getViewer(env: Env, request: Request): Promise<Viewer | null> {
  const secret = env.SESSION_SECRET;
  if (!secret) return null;

  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return null;

  const sessionId = await unstamp(raw, secret);
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT p.id, p.email, p.display_name, p.avatar_url, p.github_login, s.expires_at
       FROM sessions s
       JOIN profiles p ON p.id = s.user_id
      WHERE s.id = ?1
      LIMIT 1`,
  )
    .bind(sessionId)
    .first<{
      id: string;
      email: string;
      display_name: string | null;
      avatar_url: string | null;
      github_login: string | null;
      expires_at: string;
    }>();

  if (!row) return null;

  const expiresAt = parseUtc(row.expires_at);
  // Unparseable timestamps fail closed rather than granting an eternal session.
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    await destroySessionById(env, sessionId);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    githubLogin: row.github_login,
    roles: await rolesFor(env, row.id),
  };
}

export async function destroySession(
  env: Env,
  request: Request,
  headers: Headers,
): Promise<void> {
  const secret = env.SESSION_SECRET;
  const raw = readCookie(request, SESSION_COOKIE);
  if (secret && raw) {
    const sessionId = await unstamp(raw, secret);
    if (sessionId) await destroySessionById(env, sessionId);
  }
  clearCookie(headers, SESSION_COOKIE, isSecureRequest(request));
}

async function destroySessionById(env: Env, sessionId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(sessionId).run();
}

export function requireSecret(env: Env): string {
  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return env.SESSION_SECRET;
}
