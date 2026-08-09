import { useState } from "react";
import { HEALTH_LABEL } from "../lib/format";
import type { Health, Project, ProjectInput, ProjectStatus } from "../lib/api";

const HEALTHS: Health[] = ["nominal", "warn", "critical", "idle"];
const STATUSES: ProjectStatus[] = ["active", "paused", "archived"];

interface ProjectFormProps {
  initial?: Project | null;
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: ProjectInput) => void;
  onCancel: () => void;
}

export function ProjectForm({
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [stack, setStack] = useState(initial?.stack ?? "");
  const [repo, setRepo] = useState(initial?.repoFullName ?? "");
  const [health, setHealth] = useState<Health>(initial?.health ?? "nominal");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, domain, stack, repoFullName: repo, health, status, notes });
      }}
    >
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="field">
        <label className="hud-label" htmlFor="pf-name">Name</label>
        <input
          id="pf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Atlas UI"
          maxLength={80}
          required
          autoFocus
        />
      </div>

      <div className="form__row">
        <div className="field">
          <label className="hud-label" htmlFor="pf-domain">Domain</label>
          <input
            id="pf-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="atlas.example.com"
            maxLength={300}
          />
        </div>
        <div className="field">
          <label className="hud-label" htmlFor="pf-stack">Stack</label>
          <input
            id="pf-stack"
            value={stack}
            onChange={(e) => setStack(e.target.value)}
            placeholder="React · Workers · D1"
            maxLength={300}
          />
        </div>
      </div>

      <div className="field">
        <label className="hud-label" htmlFor="pf-repo">Repository</label>
        <input
          id="pf-repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="owner/repo"
          maxLength={300}
        />
        <span className="field__hint">Linked to the GitHub console in phase 3.</span>
      </div>

      <div className="form__row">
        <div className="field">
          <label className="hud-label" htmlFor="pf-health">Health</label>
          <select id="pf-health" value={health} onChange={(e) => setHealth(e.target.value as Health)}>
            {HEALTHS.map((h) => (
              <option key={h} value={h}>{HEALTH_LABEL[h]}</option>
            ))}
          </select>
          <span className="field__hint">Computed from error rate in phase 4.</span>
        </div>
        <div className="field">
          <label className="hud-label" htmlFor="pf-status">Status</label>
          <select id="pf-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="hud-label" htmlFor="pf-notes">Notes</label>
        <textarea
          id="pf-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="form__actions">
        <button type="button" className="btn" data-variant="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn" data-variant="primary" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : initial ? "Save changes" : "Add project"}
        </button>
      </div>
    </form>
  );
}
