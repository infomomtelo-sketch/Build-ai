import type { Env } from "./env";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiter backed by D1. Phase 1 guards the auth endpoints;
 * phases 5–6 reuse it for AI and deploy actions.
 */
export async function rateLimit(
  env: Env,
  scope: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const bucket = `${scope}:${key}:${windowStart}`;

  await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, count, window_start)
     VALUES (?1, 1, ?2)
     ON CONFLICT (bucket) DO UPDATE SET count = count + 1`,
  )
    .bind(bucket, windowStart)
    .run();

  const row = await env.DB.prepare("SELECT count FROM rate_limits WHERE bucket = ?1")
    .bind(bucket)
    .first<{ count: number }>();

  const count = row?.count ?? 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: windowStart + windowSeconds,
  };
}

/** Opportunistic cleanup so the table does not grow without bound. */
export async function pruneRateLimits(env: Env, olderThanSeconds = 3600): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - olderThanSeconds;
  await env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?1").bind(cutoff).run();
}
