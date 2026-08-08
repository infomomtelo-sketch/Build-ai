import { CoreOrb } from "../components/CoreOrb";
import { PHASES, SHIPPED_THROUGH } from "../lib/nav";
import type { CoreTelemetry, Viewer } from "../lib/api";

interface OverviewProps {
  viewer: Viewer;
  telemetry: CoreTelemetry | null;
}

export function Overview({ viewer, telemetry }: OverviewProps) {
  const nodes = telemetry?.nodes ?? [];
  const activity = telemetry?.activity ?? 0;
  const firstName = (viewer.displayName ?? viewer.email).split(/[\s@]/)[0];

  return (
    <div className="screen">
      <div className="screen__head">
        <h1 className="screen__title">Welcome back, {firstName}</h1>
        <p className="screen__sub">
          The core is live and beating against real telemetry. It runs quiet until
          phase 2 connects the project registry — then every ring, dot and number on
          this wall is driven by your actual builds.
        </p>
      </div>

      <div className="core-stage">
        <CoreOrb
          activity={activity}
          nodes={nodes}
          readout={String(nodes.length)}
          readoutLabel={nodes.length === 1 ? "repo linked" : "repos linked"}
        />

        <div className="core-caption">
          <span className="chip" data-tone={nodes.length ? "nominal" : "idle"}>
            <span className="dot" />
            {nodes.length ? "Tracking" : "Standing by"}
          </span>
          <p className="core-caption__line">
            {telemetry?.message ?? "Reading telemetry…"}
          </p>
        </div>
      </div>

      <div className="panel bracket locked">
        <div className="locked__title">Build order</div>
        <p className="locked__body">
          Each screen unlocks as its phase ships. Nothing is faked ahead of time —
          a screen goes live only once it is reading real data.
        </p>

        <div className="phase-list">
          {PHASES.map((phase) => {
            const done = phase.n <= SHIPPED_THROUGH;
            return (
              <div key={phase.n} className="phase-row" data-state={done ? "done" : "pending"}>
                <span className="phase-row__num mono">{done ? "✓" : phase.n}</span>
                <span className="phase-row__label">{phase.label}</span>
                {done && (
                  <span className="chip" data-tone="nominal">
                    Shipped
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
