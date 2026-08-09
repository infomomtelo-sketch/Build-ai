import type { Env } from "./env";
import { json, fail } from "./http";
import type { Viewer } from "./session";
import {
  dailyTotals,
  getProject,
  isDay,
  isHealth,
  isStatus,
  latestMetricsByProject,
  listProjects,
  metricsForProject,
  recentEvents,
  recordEvent,
  slugify,
  todayUtc,
  uniqueSlug,
  type Health,
  type ProjectStatus,
} from "./projects";

const MAX_NAME = 80;
const MAX_TEXT = 300;
const MAX_NOTES = 2000;

/** Trims, collapses whitespace, and enforces a ceiling. Empty becomes null. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ").slice(0, max);
  return clean.length ? clean : null;
}

/** Non-negative integer, or null when absent/invalid. */
function count(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function serializeProject(
  p: Awaited<ReturnType<typeof getProject>> & object,
  metric?: { mrr_cents: number; users: number; errors: number; uptime_pct: number | null; day: string } | null,
) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    domain: p.domain,
    stack: p.stack,
    repoFullName: p.repo_full_name,
    health: p.health,
    status: p.status,
    notes: p.notes,
    lastDeployAt: p.last_deploy_at,
    createdAt: p.created_at,
    latest: metric
      ? {
          day: metric.day,
          mrrCents: metric.mrr_cents,
          users: metric.users,
          errors: metric.errors,
          uptimePct: metric.uptime_pct,
        }
      : null,
  };
}

// ── GET /api/projects ───────────────────────────────────────────────────────
export async function handleListProjects(env: Env): Promise<Response> {
  const [projects, metrics] = await Promise.all([
    listProjects(env),
    latestMetricsByProject(env),
  ]);
  return json({
    projects: projects.map((p) => serializeProject(p, metrics.get(p.id) ?? null)),
  });
}

// ── POST /api/projects ──────────────────────────────────────────────────────
export async function handleCreateProject(
  env: Env,
  request: Request,
  viewer: Viewer,
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const name = text(body.name, MAX_NAME);
  if (!name) return fail(400, "invalid_name", "A project name is required.");

  const health = isHealth(body.health) ? body.health : ("nominal" as Health);
  const status = isStatus(body.status) ? body.status : ("active" as ProjectStatus);

  const id = crypto.randomUUID();
  const slug = await uniqueSlug(env, slugify(name));

  await env.DB.prepare(
    `INSERT INTO projects (id, name, slug, domain, stack, repo_full_name, health, status, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  )
    .bind(
      id,
      name,
      slug,
      text(body.domain, MAX_TEXT),
      text(body.stack, MAX_TEXT),
      text(body.repoFullName, MAX_TEXT),
      health,
      status,
      text(body.notes, MAX_NOTES),
    )
    .run();

  await recordEvent(env, {
    projectId: id,
    kind: "project_created",
    message: `${name} added to the registry`,
    actor: viewer.id,
  });

  const created = await getProject(env, id);
  return json({ project: serializeProject(created!) }, { status: 201 });
}

// ── GET /api/projects/:id ───────────────────────────────────────────────────
export async function handleGetProject(env: Env, id: string): Promise<Response> {
  const project = await getProject(env, id);
  if (!project) return fail(404, "not_found", "No such project.");

  const metrics = await metricsForProject(env, id);
  return json({
    project: serializeProject(project, metrics.at(-1) ?? null),
    metrics: metrics.map((m) => ({
      day: m.day,
      mrrCents: m.mrr_cents,
      users: m.users,
      signups: m.signups,
      deploys: m.deploys,
      errors: m.errors,
      uptimePct: m.uptime_pct,
      source: m.source,
    })),
  });
}

// ── PATCH /api/projects/:id ─────────────────────────────────────────────────
export async function handleUpdateProject(
  env: Env,
  request: Request,
  id: string,
  viewer: Viewer,
): Promise<Response> {
  const existing = await getProject(env, id);
  if (!existing) return fail(404, "not_found", "No such project.");

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const name = "name" in body ? text(body.name, MAX_NAME) : existing.name;
  if (!name) return fail(400, "invalid_name", "A project name is required.");

  const health = isHealth(body.health) ? body.health : existing.health;
  const status = isStatus(body.status) ? body.status : existing.status;

  await env.DB.prepare(
    `UPDATE projects
        SET name = ?2, domain = ?3, stack = ?4, repo_full_name = ?5,
            health = ?6, status = ?7, notes = ?8, updated_at = datetime('now')
      WHERE id = ?1`,
  )
    .bind(
      id,
      name,
      "domain" in body ? text(body.domain, MAX_TEXT) : existing.domain,
      "stack" in body ? text(body.stack, MAX_TEXT) : existing.stack,
      "repoFullName" in body ? text(body.repoFullName, MAX_TEXT) : existing.repo_full_name,
      health,
      status,
      "notes" in body ? text(body.notes, MAX_NOTES) : existing.notes,
    )
    .run();

  if (health !== existing.health) {
    await recordEvent(env, {
      projectId: id,
      kind: "health_changed",
      severity: health === "critical" ? "critical" : health === "warn" ? "warn" : "info",
      message: `${name} health ${existing.health} → ${health}`,
      actor: viewer.id,
    });
  }

  const updated = await getProject(env, id);
  return json({ project: serializeProject(updated!) });
}

// ── DELETE /api/projects/:id ────────────────────────────────────────────────
export async function handleDeleteProject(
  env: Env,
  id: string,
  viewer: Viewer,
): Promise<Response> {
  const existing = await getProject(env, id);
  if (!existing) return fail(404, "not_found", "No such project.");

  // The event outlives the project, so record it before the cascade removes
  // the row it references.
  await recordEvent(env, {
    projectId: null,
    kind: "project_removed",
    severity: "warn",
    message: `${existing.name} removed from the registry`,
    actor: viewer.id,
  });
  await env.DB.prepare("DELETE FROM projects WHERE id = ?1").bind(id).run();

  return json({ ok: true });
}

// ── POST /api/projects/:id/metrics ──────────────────────────────────────────
export async function handleRecordMetrics(
  env: Env,
  request: Request,
  id: string,
  viewer: Viewer,
): Promise<Response> {
  const project = await getProject(env, id);
  if (!project) return fail(404, "not_found", "No such project.");

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const day = isDay(body.day) ? body.day : todayUtc();
  if (day > todayUtc()) {
    return fail(400, "future_day", "Cannot record metrics for a future date.");
  }

  // MRR arrives as a decimal amount and is stored as integer cents — never a
  // float, so sums stay exact.
  let mrrCents = 0;
  if (body.mrr !== undefined && body.mrr !== null && body.mrr !== "") {
    const amount = Number(body.mrr);
    if (!Number.isFinite(amount) || amount < 0) {
      return fail(400, "invalid_mrr", "MRR must be a non-negative number.");
    }
    mrrCents = Math.round(amount * 100);
  }

  const uptime =
    body.uptimePct === undefined || body.uptimePct === null || body.uptimePct === ""
      ? null
      : Number(body.uptimePct);
  if (uptime !== null && (!Number.isFinite(uptime) || uptime < 0 || uptime > 100)) {
    return fail(400, "invalid_uptime", "Uptime must be between 0 and 100.");
  }

  await env.DB.prepare(
    `INSERT INTO metrics_daily
       (project_id, day, mrr_cents, users, signups, deploys, errors, uptime_pct, source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'manual')
     ON CONFLICT (project_id, day) DO UPDATE SET
       mrr_cents = excluded.mrr_cents,
       users = excluded.users,
       signups = excluded.signups,
       deploys = excluded.deploys,
       errors = excluded.errors,
       uptime_pct = excluded.uptime_pct,
       source = 'manual',
       recorded_at = datetime('now')`,
  )
    .bind(
      id,
      day,
      mrrCents,
      count(body.users) ?? 0,
      count(body.signups) ?? 0,
      count(body.deploys) ?? 0,
      count(body.errors) ?? 0,
      uptime,
    )
    .run();

  await recordEvent(env, {
    projectId: id,
    kind: "metrics_recorded",
    message: `${project.name} metrics recorded for ${day}`,
    actor: viewer.id,
  });

  return json({ ok: true, day });
}

// ── GET /api/overview ───────────────────────────────────────────────────────
export async function handleOverview(env: Env): Promise<Response> {
  const [projects, latest, series, events] = await Promise.all([
    listProjects(env),
    latestMetricsByProject(env),
    dailyTotals(env, 30),
    recentEvents(env, 40),
  ]);

  let mrrCents = 0;
  let users = 0;
  let errors = 0;
  for (const p of projects) {
    const m = latest.get(p.id);
    if (!m) continue;
    mrrCents += m.mrr_cents;
    users += m.users;
    errors += m.errors;
  }

  const last7 = series.slice(-7);
  const signups7 = last7.reduce((sum, d) => sum + d.signups, 0);
  const deploys7 = last7.reduce((sum, d) => sum + d.deploys, 0);

  const byHealth = { nominal: 0, warn: 0, critical: 0, idle: 0 };
  for (const p of projects) byHealth[p.health]++;

  return json({
    totals: {
      mrrCents,
      users,
      signups7,
      deploys7,
      errors,
      projects: projects.length,
      // Incident tracking is phase 4 — reported as null, not as a false zero.
      activeIncidents: null,
    },
    byHealth,
    series: series.map((d) => ({
      day: d.day,
      mrrCents: d.mrr_cents,
      users: d.users,
      signups: d.signups,
      deploys: d.deploys,
    })),
    projects: projects.map((p) => {
      const m = latest.get(p.id);
      return {
        id: p.id,
        name: p.name,
        health: p.health,
        domain: p.domain,
        mrrCents: m?.mrr_cents ?? null,
        users: m?.users ?? null,
        lastMetricDay: m?.day ?? null,
      };
    }),
    events: events.map((e) => ({
      id: e.id,
      at: e.at,
      kind: e.kind,
      severity: e.severity,
      message: e.message,
      projectName: e.project_name,
    })),
  });
}

// ── GET /api/core ───────────────────────────────────────────────────────────
export async function handleCore(env: Env): Promise<Response> {
  const projects = await listProjects(env);
  const series = await dailyTotals(env, 7);

  // Activity is what the orb beats to: recent deploys and signups, normalised.
  const recent = series.reduce((sum, d) => sum + d.deploys * 3 + d.signups, 0);
  const unhealthy = projects.filter((p) => p.health === "warn" || p.health === "critical").length;
  const activity = Math.min(1, recent / 60 + unhealthy * 0.15);

  return json({
    activity,
    phase: 2,
    message: projects.length
      ? `Tracking ${projects.length} project${projects.length === 1 ? "" : "s"}.`
      : "No projects yet — add one to bring the wall online.",
    nodes: projects.map((p) => ({ id: p.id, label: p.name, health: p.health })),
  });
}
