import type { Env } from "./env";

export type Role = "owner" | "operator" | "viewer";

/**
 * The single authorization chokepoint. This is the D1 stand-in for the
 * Postgres `has_role()` SECURITY DEFINER function: roles are read from the
 * dedicated `user_roles` table, never from a column on `profiles`, and no
 * caller anywhere compares role strings inline.
 */
export async function hasRole(env: Env, userId: string, role: Role): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ?1 AND role = ?2 LIMIT 1",
  )
    .bind(userId, role)
    .first<{ ok: number }>();
  return row?.ok === 1;
}

export async function rolesFor(env: Env, userId: string): Promise<Role[]> {
  const res = await env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?1 ORDER BY role",
  )
    .bind(userId)
    .all<{ role: Role }>();
  return (res.results ?? []).map((r) => r.role);
}

export async function grantRole(env: Env, userId: string, role: Role): Promise<void> {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?1, ?2)",
  )
    .bind(userId, role)
    .run();
}

/**
 * The owner allowlist. Server-side only — this value is a Worker secret and is
 * never serialized into any response, so it cannot reach client code or
 * localStorage. Comparison is case-insensitive and whitespace-tolerant.
 */
export function isAllowlistedOwner(env: Env, email: string): boolean {
  const raw = env.OWNER_EMAILS ?? "";
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
