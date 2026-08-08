import { CoreOrb } from "../components/CoreOrb";
import { StatTile } from "../components/StatTile";
import { HEALTH_LABEL, clockTime, compact, money } from "../lib/format";
import type { CoreTelemetry, Overview as OverviewData, Viewer } from "../lib/api";

interface OverviewProps {
  viewer: Viewer;
  telemetry: CoreTelemetry | null;
  data: OverviewData | null;
  onOpenProject: (id: string) => void;
  onAddProject: () => void;
}

export function Overview({
  viewer,
  telemetry,
  data,
  onOpenProject,
  onAddProject,
}: OverviewProps) {
  const firstName = (viewer.displayName ?? viewer.email).split(/[\s@]/)[0];
  const nodes = telemetry?.nodes ?? [];

  if (data && data.totals.projects === 0) {
    return (
      <div className="screen">
        <div className="screen__head">
          <h1 className="screen__title">Welcome back, {firstName}</h1>
        </div>
        <div className="core-stage">
          <CoreOrb activity={telemetry?.activity ?? 0} nodes={[]} readout="0" readoutLabel="repos linked" />
        </div>
        <div className="panel bracket locked">
          <div className="locked__title">The wall is empty</div>
          <p className="locked__body">
            Add your first project and the core starts tracking it. Metrics are
            entered by hand in this phase — the integrations that fill them in
            automatically land in phases 3 and 4.
          </p>
          <button className="btn" data-variant="primary" onClick={onAddProject}>
            Add a project
          </button>
        </div>
      </div>
    );
  }

  const series = data?.series ?? [];
  const mrrPoints = series.map((d) => ({ day: d.day, value: d.mrrCents }));
  const userPoints = series.map((d) => ({ day: d.day, value: d.users }));
  const signupPoints = series.map((d) => ({ day: d.day, value: d.signups }));
  const deployPoints = series.map((d) => ({ day: d.day, value: d.deploys }));

  return (
    <div className="screen screen--wall">
      <div className="screen__head">
        <h1 className="screen__title">Welcome back, {firstName}</h1>
        <p className="screen__sub">
          {data
            ? `${data.totals.projects} project${data.totals.projects === 1 ? "" : "s"} tracked · figures are owner-entered until integrations land`
            : "Reading telemetry…"}
        </p>
      </div>

      <div className="wall">
        {/* ── left rail: per-project health ─────────────────────────────── */}
        <aside className="wall__rail panel" aria-label="Project health">
          <div className="wall__rail-head">
            <span className="hud-label">Projects</span>
            <button className="btn" data-variant="ghost" onClick={onAddProject}>
              Add
            </button>
          </div>

          <ul className="health-list">
            {(data?.projects ?? []).map((p) => (
              <li key={p.id}>
                <button className="health-row" onClick={() => onOpenProject(p.id)}>
                  <span className="dot" style={{ color: `var(--status-${p.health})` }} />
                  <span className="health-row__body">
                    <span className="health-row__name">{p.name}</span>
                    {/* Status is never colour alone — the state is spelled out. */}
                    <span className="health-row__state">{HEALTH_LABEL[p.health]}</span>
                  </span>
                  <span className="health-row__mrr mono">{money(p.mrrCents)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── centre: numbers + core ────────────────────────────────────── */}
        <div className="wall__main">
          <div className="tile-grid">
            <StatTile
              label="MRR"
              value={money(data?.totals.mrrCents ?? null)}
              caption="across all projects"
              points={mrrPoints}
              format={money}
            />
            <StatTile
              label="Total users"
              value={compact(data?.totals.users ?? null)}
              caption="latest reading per project"
              points={userPoints}
              format={compact}
            />
            <StatTile
              label="Signups · 7d"
              value={compact(data?.totals.signups7 ?? null)}
              caption="rolling week"
              points={signupPoints}
              format={compact}
            />
            <StatTile
              label="Deploys · 7d"
              value={compact(data?.totals.deploys7 ?? null)}
              caption="rolling week"
              points={deployPoints}
              format={compact}
            />
            <StatTile
              label="Active incidents"
              value="—"
              caption="phase 4"
              placeholder={
                <div className="tile__pending hud-label">
                  Awaiting error ingest
                </div>
              }
            />

            {/* The core occupies the grid's remaining cell rather than being
                stranded below the tiles. */}
            <div className="tile-grid__core">
              <CoreOrb
                activity={telemetry?.activity ?? 0}
                nodes={nodes}
                readout={String(nodes.length)}
                readoutLabel={nodes.length === 1 ? "project" : "projects"}
              />
              <p className="core-caption__line">{telemetry?.message ?? ""}</p>
            </div>
          </div>
        </div>

        {/* ── right rail: rolling event log ─────────────────────────────── */}
        <aside className="wall__rail panel" aria-label="Event log">
          <div className="wall__rail-head">
            <span className="hud-label">Event log</span>
          </div>

          <ol className="event-log">
            {(data?.events ?? []).map((e) => (
              <li key={e.id} className="event" data-severity={e.severity}>
                <span className="event__time mono">{clockTime(e.at)}</span>
                <span className="event__body">
                  <span className="event__message">{e.message}</span>
                  <span className="event__kind mono">{e.kind}</span>
                </span>
              </li>
            ))}
            {!data?.events.length && (
              <li className="event event--empty hud-label">No activity yet</li>
            )}
          </ol>
        </aside>
      </div>
    </div>
  );
}
