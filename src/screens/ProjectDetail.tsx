import { useCallback, useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import { ProjectForm } from "../components/ProjectForm";
import { Sparkline } from "../components/Sparkline";
import {
  HEALTH_LABEL,
  compact,
  dayLabel,
  money,
  percent,
  relativeTime,
} from "../lib/format";
import {
  api,
  ApiError,
  type MetricPoint,
  type Project,
  type ProjectInput,
} from "../lib/api";

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onChanged: () => void;
}

/** Today in UTC, matching how the server buckets a metrics day. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const BLANK = { day: todayUtc(), mrr: "", users: "", signups: "", deploys: "", errors: "", uptimePct: "" };

export function ProjectDetail({ projectId, onBack, onChanged }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState(BLANK);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.project(projectId);
      setProject(res.project);
      setMetrics(res.metrics);
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pre-fill the form with the selected day's existing figures, so editing a
  // past entry doesn't silently zero the fields left untouched.
  useEffect(() => {
    const existing = metrics.find((m) => m.day === entry.day);
    setEntry((prev) => ({
      ...prev,
      mrr: existing ? String(existing.mrrCents / 100) : "",
      users: existing ? String(existing.users) : "",
      signups: existing ? String(existing.signups) : "",
      deploys: existing ? String(existing.deploys) : "",
      errors: existing ? String(existing.errors) : "",
      uptimePct: existing?.uptimePct != null ? String(existing.uptimePct) : "",
    }));
  }, [entry.day, metrics]);

  async function submitMetrics(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await api.recordMetrics(projectId, entry);
      setSaved(res.day);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record metrics.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProject(input: ProjectInput) {
    setBusy(true);
    setError(null);
    try {
      await api.updateProject(projectId, input);
      setEditing(false);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the project.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteProject(projectId);
      onChanged();
      onBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the project.");
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="screen">
        <div className="panel bracket locked">
          <div className="locked__title">Project not found</div>
          <p className="locked__body">It may have been removed.</p>
          <button className="btn" onClick={onBack}>Back to registry</button>
        </div>
      </div>
    );
  }

  if (loading && !project) {
    return (
      <div className="screen">
        <div className="panel locked"><span className="hud-label">Loading project…</span></div>
      </div>
    );
  }

  if (!project) return null;

  const latest = metrics.at(-1) ?? null;

  return (
    <div className="screen">
      <button className="btn" data-variant="ghost" onClick={onBack}>← Registry</button>

      <div className="screen__head screen__head--row" style={{ marginTop: "var(--space-4)" }}>
        <div>
          <div className="detail__badges">
            <span className="chip" data-tone={project.health}>
              <span className="dot" />
              {HEALTH_LABEL[project.health]}
            </span>
            {project.status !== "active" && (
              <span className="chip" data-tone="idle">{project.status}</span>
            )}
            {project.repoFullName && (
              <span className="chip">{project.repoFullName}</span>
            )}
          </div>
          <h1 className="screen__title">{project.name}</h1>
          <p className="screen__sub mono">{project.domain ?? "no domain set"} · {project.stack ?? "stack not set"}</p>
        </div>
        <div className="detail__actions">
          <button className="btn" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn" data-variant="ghost" onClick={() => setConfirmDelete(true)}>
            Remove
          </button>
        </div>
      </div>

      {project.notes && <p className="detail__notes">{project.notes}</p>}

      {/* ── trend ───────────────────────────────────────────────────────── */}
      <div className="detail__grid">
        <section className="panel bracket detail__card">
          <div className="hud-label">MRR trend</div>
          <div className="tile__value mono">{money(latest?.mrrCents ?? null)}</div>
          {metrics.length >= 2 ? (
            <Sparkline
              points={metrics.map((m) => ({ day: m.day, value: m.mrrCents }))}
              format={money}
              label="MRR"
            />
          ) : (
            <p className="detail__empty hud-label">Record two days to see a trend</p>
          )}
        </section>

        <section className="panel bracket detail__card">
          <div className="hud-label">Users</div>
          <div className="tile__value mono">{compact(latest?.users ?? null)}</div>
          {metrics.length >= 2 ? (
            <Sparkline
              points={metrics.map((m) => ({ day: m.day, value: m.users }))}
              format={compact}
              label="Users"
            />
          ) : (
            <p className="detail__empty hud-label">Record two days to see a trend</p>
          )}
        </section>

        <section className="panel bracket detail__card">
          <div className="hud-label">Errors</div>
          <div className="tile__value mono">{compact(latest?.errors ?? null)}</div>
          {metrics.length >= 2 ? (
            <Sparkline
              points={metrics.map((m) => ({ day: m.day, value: m.errors }))}
              format={compact}
              label="Errors"
            />
          ) : (
            <p className="detail__empty hud-label">Record two days to see a trend</p>
          )}
        </section>
      </div>

      {/* ── manual entry ────────────────────────────────────────────────── */}
      <section className="panel bracket detail__entry">
        <div className="hud-label">Record metrics</div>
        <p className="detail__hint">
          One entry per day. Saving the same day again overwrites it.
        </p>

        <form className="metrics-form" onSubmit={submitMetrics}>
          {error && <div className="alert" role="alert"><span>{error}</span></div>}
          {saved && (
            <div className="alert" data-tone="ok" role="status">
              <span>Saved {dayLabel(saved)}.</span>
            </div>
          )}

          <div className="metrics-form__grid">
            <div className="field">
              <label className="hud-label" htmlFor="m-day">Day</label>
              <input
                id="m-day"
                type="date"
                max={todayUtc()}
                value={entry.day}
                onChange={(e) => setEntry({ ...entry, day: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="hud-label" htmlFor="m-mrr">MRR (USD)</label>
              <input id="m-mrr" type="number" min="0" step="0.01" value={entry.mrr}
                onChange={(e) => setEntry({ ...entry, mrr: e.target.value })} placeholder="0.00" />
            </div>
            <div className="field">
              <label className="hud-label" htmlFor="m-users">Users</label>
              <input id="m-users" type="number" min="0" step="1" value={entry.users}
                onChange={(e) => setEntry({ ...entry, users: e.target.value })} placeholder="0" />
            </div>
            <div className="field">
              <label className="hud-label" htmlFor="m-signups">Signups</label>
              <input id="m-signups" type="number" min="0" step="1" value={entry.signups}
                onChange={(e) => setEntry({ ...entry, signups: e.target.value })} placeholder="0" />
            </div>
            <div className="field">
              <label className="hud-label" htmlFor="m-deploys">Deploys</label>
              <input id="m-deploys" type="number" min="0" step="1" value={entry.deploys}
                onChange={(e) => setEntry({ ...entry, deploys: e.target.value })} placeholder="0" />
            </div>
            <div className="field">
              <label className="hud-label" htmlFor="m-errors">Errors</label>
              <input id="m-errors" type="number" min="0" step="1" value={entry.errors}
                onChange={(e) => setEntry({ ...entry, errors: e.target.value })} placeholder="0" />
            </div>
            <div className="field">
              <label className="hud-label" htmlFor="m-uptime">Uptime %</label>
              <input id="m-uptime" type="number" min="0" max="100" step="0.01" value={entry.uptimePct}
                onChange={(e) => setEntry({ ...entry, uptimePct: e.target.value })} placeholder="99.99" />
            </div>
          </div>

          <div className="form__actions">
            <button className="btn" data-variant="primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Record"}
            </button>
          </div>
        </form>
      </section>

      {/* ── history ─────────────────────────────────────────────────────── */}
      {metrics.length > 0 && (
        <section className="panel detail__history">
          <div className="hud-label" style={{ padding: "var(--space-4)" }}>History</div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Day</th><th>MRR</th><th>Users</th><th>Signups</th>
                  <th>Deploys</th><th>Errors</th><th>Uptime</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {[...metrics].reverse().map((m) => (
                  <tr key={m.day}>
                    <td className="mono">{dayLabel(m.day)}</td>
                    <td className="mono">{money(m.mrrCents)}</td>
                    <td className="mono">{compact(m.users)}</td>
                    <td className="mono">{compact(m.signups)}</td>
                    <td className="mono">{compact(m.deploys)}</td>
                    <td className="mono">{compact(m.errors)}</td>
                    <td className="mono">{percent(m.uptimePct)}</td>
                    <td><span className="chip" data-tone="idle">{m.source}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="detail__meta hud-label">
        Added {relativeTime(project.createdAt)}
      </p>

      {editing && (
        <Modal title="Edit project" onClose={() => setEditing(false)}>
          <ProjectForm
            initial={project}
            busy={busy}
            error={error}
            onSubmit={saveProject}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Remove project" onClose={() => setConfirmDelete(false)}>
          <p className="locked__body" style={{ textAlign: "left" }}>
            This removes <strong>{project.name}</strong> and all of its recorded
            metrics. It cannot be undone.
          </p>
          <div className="form__actions">
            <button className="btn" data-variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="btn" data-variant="danger" onClick={() => void remove()} disabled={busy}>
              {busy ? "Removing…" : "Remove permanently"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
