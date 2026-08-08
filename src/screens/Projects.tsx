import { useState } from "react";
import { Modal } from "../components/Modal";
import { ProjectForm } from "../components/ProjectForm";
import { HEALTH_LABEL, compact, money, percent, relativeTime } from "../lib/format";
import { api, ApiError, type Project, type ProjectInput } from "../lib/api";

interface ProjectsProps {
  projects: Project[];
  loading: boolean;
  composing: boolean;
  onCompose: (open: boolean) => void;
  onChanged: () => void;
  onOpenProject: (id: string) => void;
}

export function Projects({
  projects,
  loading,
  composing,
  onCompose,
  onChanged,
  onOpenProject,
}: ProjectsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(input: ProjectInput) {
    setBusy(true);
    setError(null);
    try {
      await api.createProject(input);
      onCompose(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen__head screen__head--row">
        <div>
          <h1 className="screen__title">Project Registry</h1>
          <p className="screen__sub">
            One card per build. Metrics are entered by hand in this phase; the
            GitHub, Stripe and error integrations write to the same rows later.
          </p>
        </div>
        <button className="btn" data-variant="primary" onClick={() => onCompose(true)}>
          Add project
        </button>
      </div>

      {loading && !projects.length && (
        <div className="panel locked">
          <span className="hud-label">Loading registry…</span>
        </div>
      )}

      {!loading && !projects.length && (
        <div className="panel bracket locked">
          <div className="locked__title">No projects yet</div>
          <p className="locked__body">
            Register your first build to bring the wall online.
          </p>
          <button className="btn" data-variant="primary" onClick={() => onCompose(true)}>
            Add project
          </button>
        </div>
      )}

      <div className="project-grid">
        {projects.map((p) => (
          <button
            key={p.id}
            className="panel bracket project-card"
            onClick={() => onOpenProject(p.id)}
          >
            <header className="project-card__head">
              <span className="chip" data-tone={p.health}>
                <span className="dot" />
                {HEALTH_LABEL[p.health]}
              </span>
              {p.status !== "active" && (
                <span className="chip" data-tone="idle">{p.status}</span>
              )}
            </header>

            <h3 className="project-card__name">{p.name}</h3>
            <p className="project-card__domain mono">{p.domain ?? "no domain set"}</p>

            <dl className="project-card__stats">
              <div>
                <dt className="hud-label">MRR</dt>
                <dd className="mono">{money(p.latest?.mrrCents ?? null)}</dd>
              </div>
              <div>
                <dt className="hud-label">Users</dt>
                <dd className="mono">{compact(p.latest?.users ?? null)}</dd>
              </div>
              <div>
                <dt className="hud-label">Uptime</dt>
                <dd className="mono">{percent(p.latest?.uptimePct ?? null)}</dd>
              </div>
              <div>
                <dt className="hud-label">Errors</dt>
                <dd className="mono">{compact(p.latest?.errors ?? null)}</dd>
              </div>
            </dl>

            <footer className="project-card__foot">
              <span className="mono">{p.stack ?? "stack not set"}</span>
              <span className="mono">
                {p.latest ? `data ${relativeTime(p.latest.day)}` : "no metrics yet"}
              </span>
            </footer>
          </button>
        ))}
      </div>

      {composing && (
        <Modal
          title="Add project"
          subtitle="Everything here is editable later."
          onClose={() => onCompose(false)}
        >
          <ProjectForm busy={busy} error={error} onSubmit={create} onCancel={() => onCompose(false)} />
        </Modal>
      )}
    </div>
  );
}
