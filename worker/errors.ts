import { randomId } from "./crypto";
import { fail, json } from "./http";
import { parseUtc } from "./session";
import type { Env } from "./env";

interface ErrorEvent {
  message: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
  sessionId?: string;
  userId?: string;
}

interface ErrorGroup {
  fingerprint: string;
  message: string;
  count: number;
  affectedSessions: number;
  firstSeen: string;
  lastSeen: string;
  impactScore: number;
  resolved: boolean;
}

// Fingerprint: hash of message + first 3 lines of stack trace
// Groups similar errors together regardless of exact context
export function fingerprint(error: ErrorEvent): string {
  const lines = [error.message];
  if (error.stackTrace) {
    const stackLines = error.stackTrace.split("\n").slice(0, 3);
    lines.push(...stackLines);
  }
  const combined = lines.join("\n");

  // Simple hash (not cryptographic; just for grouping)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(16);
}

export async function handleIngestError(
  env: Env,
  projectId: string,
  request: Request,
): Promise<Response> {
  try {
    const body = (await request.json()) as ErrorEvent;
    if (!body.message) {
      return fail(400, "bad_request", "Error message required.");
    }

    const fp = fingerprint(body);
    const id = randomId();
    const contextJson = body.context ? JSON.stringify(body.context) : null;

    const db = env.DB;

    // Upsert: insert if new fingerprint, else update count + last_seen
    await db
      .prepare(
        `
        INSERT INTO errors (id, project_id, fingerprint, message, stack_trace, context, count, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id, fingerprint) DO UPDATE SET
          count = count + 1,
          last_seen = CURRENT_TIMESTAMP,
          stack_trace = COALESCE(excluded.stack_trace, stack_trace),
          context = COALESCE(excluded.context, context)
      `,
      )
      .bind(id, projectId, fp, body.message, body.stackTrace ?? null, contextJson)
      .run();

    return json({ ok: true, fingerprint: fp });
  } catch (err) {
    console.error("Error ingestion failed:", err);
    return fail(500, "ingest_failed", `Failed to ingest error: ${String(err)}`);
  }
}

export async function handleListErrors(
  env: Env,
  projectId: string,
): Promise<Response> {
  try {
    const db = env.DB;

    // Fetch all unresolved errors for the project, grouped by fingerprint
    const errors = await db
      .prepare(
        `
        SELECT DISTINCT
          fingerprint,
          message,
          count,
          affected_sessions,
          first_seen,
          last_seen,
          resolved_at
        FROM errors
        WHERE project_id = ? AND resolved_at IS NULL
        ORDER BY last_seen DESC
        LIMIT 100
      `,
      )
      .bind(projectId)
      .all<{
        fingerprint: string;
        message: string;
        count: number;
        affected_sessions: number;
        first_seen: string;
        last_seen: string;
        resolved_at: string | null;
      }>();

    if (!errors.results) {
      return json({ errors: [] });
    }

    // Compute impact scores
    const groups: ErrorGroup[] = errors.results.map((e) => ({
      fingerprint: e.fingerprint,
      message: e.message,
      count: e.count,
      affectedSessions: e.affected_sessions,
      firstSeen: e.first_seen,
      lastSeen: e.last_seen,
      impactScore: computeImpactScore(e.count, e.affected_sessions, e.last_seen),
      resolved: !!e.resolved_at,
    }));

    // Sort by impact score descending
    groups.sort((a, b) => b.impactScore - a.impactScore);

    return json({ errors: groups });
  } catch (err) {
    console.error("Failed to list errors:", err);
    return fail(500, "list_failed", `Failed to list errors: ${String(err)}`);
  }
}

export async function handleGetErrorGroup(
  env: Env,
  projectId: string,
  fingerprint: string,
): Promise<Response> {
  try {
    const db = env.DB;

    const result = await db
      .prepare(
        `
        SELECT
          fingerprint,
          message,
          stack_trace,
          context,
          count,
          affected_sessions,
          first_seen,
          last_seen,
          resolved_at
        FROM errors
        WHERE project_id = ? AND fingerprint = ?
        LIMIT 1
      `,
      )
      .bind(projectId, fingerprint)
      .first<{
        fingerprint: string;
        message: string;
        stack_trace: string | null;
        context: string | null;
        count: number;
        affected_sessions: number;
        first_seen: string;
        last_seen: string;
        resolved_at: string | null;
      }>();

    if (!result) {
      return fail(404, "not_found", "Error group not found.");
    }

    const contextObj = result.context ? JSON.parse(result.context) : null;

    return json({
      group: {
        fingerprint: result.fingerprint,
        message: result.message,
        stackTrace: result.stack_trace,
        context: contextObj,
        count: result.count,
        affectedSessions: result.affected_sessions,
        firstSeen: result.first_seen,
        lastSeen: result.last_seen,
        impactScore: computeImpactScore(result.count, result.affected_sessions, result.last_seen),
        resolved: !!result.resolved_at,
      },
    });
  } catch (err) {
    console.error("Failed to get error group:", err);
    return fail(500, "fetch_failed", `Failed to fetch error group: ${String(err)}`);
  }
}

export async function handleResolveError(
  env: Env,
  projectId: string,
  fingerprint: string,
): Promise<Response> {
  try {
    const db = env.DB;

    await db
      .prepare(
        `
        UPDATE errors
        SET resolved_at = CURRENT_TIMESTAMP
        WHERE project_id = ? AND fingerprint = ?
      `,
      )
      .bind(projectId, fingerprint)
      .run();

    return json({ ok: true });
  } catch (err) {
    console.error("Failed to resolve error:", err);
    return fail(500, "resolve_failed", `Failed to resolve error: ${String(err)}`);
  }
}

// Impact score: rank errors by user impact
// Considers: frequency (count), affected sessions, and recency
function computeImpactScore(
  count: number,
  affectedSessions: number,
  lastSeen: string,
): number {
  const now = Date.now();
  // SQLite hands back `2026-08-10 20:53:53`, which `new Date()` would read as
  // local time. parseUtc pins it to UTC, matching how the row was written.
  const lastSeenMs = parseUtc(lastSeen);
  if (Number.isNaN(lastSeenMs)) return 0;
  const hoursSinceLast = (now - lastSeenMs) / (1000 * 60 * 60);

  // Recency decay: full score if within 1 hour, halved at 24 hours, minimal after 7 days
  const recencyFactor = Math.max(0.1, 1 / (1 + hoursSinceLast / 24));

  // Base score from frequency and affected sessions
  const frequency = Math.log(count + 1); // logarithmic; 100 errors ~6.6x worse than 10
  const sessionImpact = affectedSessions > 0 ? Math.log(affectedSessions + 1) : 0;

  return (frequency + sessionImpact) * recencyFactor;
}
