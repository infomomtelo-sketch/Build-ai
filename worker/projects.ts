import type { Env } from "./env";

export type Health = "nominal" | "warn" | "critical" | "idle";
export type ProjectStatus = "active" | "paused" | "archived";

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  stack: string | null;
  repo_full_name: string | null;
  health: Health;
  status: ProjectStatus;
  notes: string | null;
  last_deploy_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetricRow {
  day: string;
  mrr_cents: number;
  users: number;
  signups: number;
  deploys: number;
  errors: number;
  uptime_pct: number | null;
  source: string;
}

const HEALTHS: Health[] = ["nominal", "warn", "critical", "idle"];
const STATUSES: ProjectStatus[] = ["active", "paused", "archived"];

export function isHealth(v: unknown): v is Health {
  return typeof v === "string" && (HEALTHS as string[]).includes(v);
}

export function isStatus(v: unknown): v is ProjectStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}

/** `YYYY-MM-DD`, and a real calendar date — not just the right shape. */
export function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Days back from today, inclusive, oldest first. */
export function dayRange(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(now - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

// ── reads ───────────────────────────────────────────────────────────────────

export async function listProjects(env: Env): Promise<ProjectRow[]> {
  const res = await env.DB.prepare(
    `SELECT * FROM projects
      WHERE status != 'archived'
      ORDER BY CASE health
                 WHEN 'critical' THEN 0
                 WHEN 'warn' THEN 1
                 WHEN 'nominal' THEN 2
                 ELSE 3
               END,
               name COLLATE NOCASE`,
  ).all<ProjectRow>();
  return res.results ?? [];
}

export async function getProject(env: Env, id: string): Promise<ProjectRow | null> {
  return env.DB.prepare("SELECT * FROM projects WHERE id = ?1")
    .bind(id)
    .first<ProjectRow>();
}

/** The most recent metric row per project, for the registry cards. */
export async function latestMetricsByProject(
  env: Env,
): Promise<Map<string, MetricRow>> {
  const res = await env.DB.prepare(
    `SELECT m.project_id, m.day, m.mrr_cents, m.users, m.signups,
            m.deploys, m.errors, m.uptime_pct, m.source
       FROM metrics_daily m
       JOIN (
         SELECT project_id, MAX(day) AS day
           FROM metrics_daily
          GROUP BY project_id
       ) latest
         ON latest.project_id = m.project_id AND latest.day = m.day`,
  ).all<MetricRow & { project_id: string }>();

  const map = new Map<string, MetricRow>();
  for (const row of res.results ?? []) {
    const { project_id, ...metric } = row;
    map.set(project_id, metric);
  }
  return map;
}

export async function metricsForProject(
  env: Env,
  projectId: string,
  limit = 60,
): Promise<MetricRow[]> {
  const res = await env.DB.prepare(
    `SELECT day, mrr_cents, users, signups, deploys, errors, uptime_pct, source
       FROM metrics_daily
      WHERE project_id = ?1
      ORDER BY day DESC
      LIMIT ?2`,
  )
    .bind(projectId, limit)
    .all<MetricRow>();
  return (res.results ?? []).reverse();
}

/**
 * Daily totals across every project, for the wall's sparklines. MRR and users
 * are levels, so they are summed from each project's latest reading on or
 * before that day rather than only from rows that happen to exist. Signups and
 * deploys are flows, so they sum directly.
 */
export async function dailyTotals(
  env: Env,
  days: number,
): Promise<{ day: string; mrr_cents: number; users: number; signups: number; deploys: number }[]> {
  const range = dayRange(days);
  const since = range[0];

  const res = await env.DB.prepare(
    `SELECT project_id, day, mrr_cents, users, signups, deploys
       FROM metrics_daily
      WHERE day >= ?1
      ORDER BY day`,
  )
    .bind(since)
    .all<{
      project_id: string;
      day: string;
      mrr_cents: number;
      users: number;
      signups: number;
      deploys: number;
    }>();

  // Levels carried forward from before the window, so day one is not a cliff.
  const priorRes = await env.DB.prepare(
    `SELECT m.project_id, m.mrr_cents, m.users
       FROM metrics_daily m
       JOIN (
         SELECT project_id, MAX(day) AS day
           FROM metrics_daily
          WHERE day < ?1
          GROUP BY project_id
       ) p ON p.project_id = m.project_id AND p.day = m.day`,
  )
    .bind(since)
    .all<{ project_id: string; mrr_cents: number; users: number }>();

  const levels = new Map<string, { mrr: number; users: number }>();
  for (const r of priorRes.results ?? []) {
    levels.set(r.project_id, { mrr: r.mrr_cents, users: r.users });
  }

  const byDay = new Map<string, typeof res.results>();
  for (const row of res.results ?? []) {
    const bucket = byDay.get(row.day) ?? [];
    bucket.push(row);
    byDay.set(row.day, bucket);
  }

  return range.map((day) => {
    let signups = 0;
    let deploys = 0;
    for (const row of byDay.get(day) ?? []) {
      levels.set(row.project_id, { mrr: row.mrr_cents, users: row.users });
      signups += row.signups;
      deploys += row.deploys;
    }
    let mrr = 0;
    let users = 0;
    for (const level of levels.values()) {
      mrr += level.mrr;
      users += level.users;
    }
    return { day, mrr_cents: mrr, users, signups, deploys };
  });
}

export async function recentEvents(env: Env, limit = 40) {
  const res = await env.DB.prepare(
    `SELECT e.id, e.at, e.kind, e.severity, e.message, e.project_id,
            p.name AS project_name
       FROM events e
       LEFT JOIN projects p ON p.id = e.project_id
      ORDER BY e.at DESC, e.id DESC
      LIMIT ?1`,
  )
    .bind(limit)
    .all<{
      id: number;
      at: string;
      kind: string;
      severity: string;
      message: string;
      project_id: string | null;
      project_name: string | null;
    }>();
  return res.results ?? [];
}

// ── writes ──────────────────────────────────────────────────────────────────

export async function recordEvent(
  env: Env,
  e: {
    projectId?: string | null;
    kind: string;
    severity?: "info" | "warn" | "critical";
    message: string;
    actor?: string | null;
  },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO events (project_id, kind, severity, message, actor)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(e.projectId ?? null, e.kind, e.severity ?? "info", e.message, e.actor ?? null)
    .run();
}

/** Ensures a unique slug by suffixing -2, -3, … when needed. */
export async function uniqueSlug(env: Env, base: string): Promise<string> {
  const root = base || "project";
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const hit = await env.DB.prepare("SELECT 1 AS x FROM projects WHERE slug = ?1")
      .bind(candidate)
      .first<{ x: number }>();
    if (!hit) return candidate;
  }
  return `${root}-${Date.now()}`;
}
