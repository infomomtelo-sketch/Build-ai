import { useState, useEffect, useCallback } from "react";
import { Modal } from "../components/Modal";
import { compact, relativeTime } from "../lib/format";
import { api, ApiError, type Project } from "../lib/api";

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

interface ErrorDetail extends ErrorGroup {
  stackTrace: string | null;
  context: Record<string, unknown> | null;
}

interface FixQueueProps {
  projects: Project[];
}

function ErrorCard({
  group,
  onSelect,
  onResolve,
}: {
  group: ErrorGroup;
  onSelect: () => void;
  onResolve: () => void;
}) {
  const impact = group.impactScore;
  const tone = impact > 5 ? "critical" : impact > 2 ? "warn" : "nominal";

  return (
    <div className="error-card panel bracket" data-tone={tone}>
      <button className="error-card__body" onClick={onSelect}>
        <div className="error-card__head">
          <span className="chip" data-tone={tone}>
            <span className="dot" />
            impact {impact.toFixed(1)}
          </span>
          <span className="error-card__count mono">{compact(group.count)}×</span>
        </div>

        <div className="error-card__message">{group.message}</div>

        <div className="error-card__meta mono">
          <span>{compact(group.affectedSessions)} sessions</span>
          <span>last {relativeTime(group.lastSeen)}</span>
        </div>
      </button>

      <div className="error-card__actions">
        <button className="btn" data-variant="ghost" onClick={onResolve}>
          Resolve
        </button>
      </div>
    </div>
  );
}

export function FixQueue({ projects }: FixQueueProps) {
  const [selectedProject, setSelectedProject] = useState<string>(
    projects[0]?.id ?? "",
  );
  const [errors, setErrors] = useState<ErrorGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ErrorDetail | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.projectErrors(selectedProject);
      setErrors(res.errors ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load errors.");
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    void loadErrors();
  }, [loadErrors]);

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject]);

  async function openDetail(fingerprint: string) {
    try {
      const res = await api.errorGroup(selectedProject, fingerprint);
      setDetail(res.group);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load error detail.");
    }
  }

  async function resolveError(fingerprint: string) {
    setResolving(true);
    try {
      await api.resolveError(selectedProject, fingerprint);
      setDetail(null);
      await loadErrors();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resolve error.");
    } finally {
      setResolving(false);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="screen">
        <div className="panel bracket locked">
          <div className="locked__title">No projects registered</div>
          <p className="locked__body">
            Add a project first, then errors can be tracked against it.
          </p>
        </div>
      </div>
    );
  }

  const project = projects.find((p) => p.id === selectedProject);

  return (
    <div className="screen">
      <div className="screen__head">
        <h1 className="screen__title">Fix Queue</h1>
        <p className="screen__sub">
          Errors grouped by fingerprint, ranked by user impact. Resolve to remove
          from the queue.
        </p>
      </div>

      <div className="fix-queue__controls">
        <label className="hud-label">Project</label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="repo-select"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="btn" data-variant="ghost" onClick={() => void loadErrors()}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
        </div>
      )}

      {loading && errors.length === 0 && (
        <div className="panel locked">
          <span className="hud-label">Loading errors…</span>
        </div>
      )}

      {!loading && errors.length === 0 && (
        <div className="panel bracket locked">
          <div className="locked__title">Queue is clear</div>
          <p className="locked__body">
            No unresolved errors for {project?.name ?? "this project"}. Errors
            arrive from your app's error reporter and are grouped by stack
            fingerprint.
          </p>
        </div>
      )}

      <div className="error-list">
        {errors.map((group) => (
          <ErrorCard
            key={group.fingerprint}
            group={group}
            onSelect={() => void openDetail(group.fingerprint)}
            onResolve={() => void resolveError(group.fingerprint)}
          />
        ))}
      </div>

      {detail && (
        <Modal
          title="Error detail"
          subtitle={`Fingerprint ${detail.fingerprint}`}
          onClose={() => setDetail(null)}
        >
          <div className="error-detail">
            <div className="error-detail__section">
              <div className="hud-label">Message</div>
              <p className="error-detail__message mono">{detail.message}</p>
            </div>

            <div className="error-detail__stats">
              <div>
                <div className="hud-label">Occurrences</div>
                <div className="mono">{compact(detail.count)}</div>
              </div>
              <div>
                <div className="hud-label">Sessions</div>
                <div className="mono">{compact(detail.affectedSessions)}</div>
              </div>
              <div>
                <div className="hud-label">Impact</div>
                <div className="mono">{detail.impactScore.toFixed(2)}</div>
              </div>
            </div>

            {detail.stackTrace && (
              <div className="error-detail__section">
                <div className="hud-label">Stack trace</div>
                <pre className="error-detail__stack mono">{detail.stackTrace}</pre>
              </div>
            )}

            {detail.context && (
              <div className="error-detail__section">
                <div className="hud-label">Context</div>
                <pre className="error-detail__context mono">
                  {JSON.stringify(detail.context, null, 2)}
                </pre>
              </div>
            )}

            <div className="error-detail__timeline mono">
              <span>First: {relativeTime(detail.firstSeen)}</span>
              <span>Last: {relativeTime(detail.lastSeen)}</span>
            </div>

            <div className="form__actions">
              <button className="btn" data-variant="ghost" onClick={() => setDetail(null)}>
                Close
              </button>
              <button
                className="btn"
                data-variant="primary"
                onClick={() => void resolveError(detail.fingerprint)}
                disabled={resolving}
              >
                {resolving ? "Resolving…" : "Mark resolved"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
