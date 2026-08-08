import { useId, useMemo } from "react";

export type NodeHealth = "nominal" | "warn" | "critical" | "idle";

export interface CoreNode {
  id: string;
  label: string;
  health: NodeHealth;
}

interface CoreOrbProps {
  /** 0 → dormant, 1 → saturated. Drives pulse rate and ring energy. */
  activity: number;
  /** One orbiting dot per connected repo, coloured by health. */
  nodes: CoreNode[];
  /** Large figure in the centre of the orb. */
  readout?: string;
  readoutLabel?: string;
  /** Hides the centre readout — used on the login screen. */
  bare?: boolean;
}

const HEALTH_TOKEN: Record<NodeHealth, string> = {
  nominal: "var(--status-nominal)",
  warn: "var(--status-warn)",
  critical: "var(--status-critical)",
  idle: "var(--status-idle)",
};

/** Evenly distributed points on a circle, starting at 12 o'clock. */
function pointOnCircle(index: number, count: number, radius: number, phase = 0) {
  const angle = (index / Math.max(count, 1)) * Math.PI * 2 + phase - Math.PI / 2;
  return { x: 100 + Math.cos(angle) * radius, y: 100 + Math.sin(angle) * radius };
}

export function CoreOrb({
  activity,
  nodes,
  readout,
  readoutLabel,
  bare = false,
}: CoreOrbProps) {
  const uid = useId().replace(/:/g, "");
  const energy = Math.min(Math.max(activity, 0), 1);

  // The orb literally beats faster as activity rises: 4.2s at rest → 0.9s hot.
  const style = useMemo(
    () =>
      ({
        "--core-pulse": `${(4.2 - energy * 3.3).toFixed(2)}s`,
        "--core-spin": `${(60 - energy * 34).toFixed(0)}s`,
      }) as React.CSSProperties,
    [energy],
  );

  // Nodes are split across two orbits so a long repo list stays readable.
  const orbits = useMemo(() => {
    const inner = nodes.filter((_, i) => i % 2 === 0);
    const outer = nodes.filter((_, i) => i % 2 === 1);
    return [
      { radius: 62, nodes: inner, duration: 26, direction: 1 },
      { radius: 84, nodes: outer, duration: 38, direction: -1 },
    ];
  }, [nodes]);

  return (
    <div className="core" style={style}>
      <div className="core__halo" aria-hidden="true" />

      <svg
        className="core__svg"
        viewBox="0 0 200 200"
        role="img"
        aria-label={`System core. Activity ${Math.round(energy * 100)} percent. ${nodes.length} connected repositories.`}
      >
        <defs>
          {/* A dark well with a luminous shell — the readout has to stay
              readable at the centre, so the brightness lives on the rim. */}
          <radialGradient id={`${uid}-nucleus`}>
            {bare ? (
              // Nothing sits over the centre, so let it glow.
              <>
                <stop offset="0%" stopColor="var(--accent-bright)" stopOpacity="0.7" />
                <stop offset="42%" stopColor="var(--accent)" stopOpacity="0.4" />
                <stop offset="80%" stopColor="var(--accent-deep)" stopOpacity="0.42" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="var(--surface-void)" stopOpacity="0.94" />
                <stop offset="48%" stopColor="var(--surface-void)" stopOpacity="0.82" />
                <stop offset="76%" stopColor="var(--accent-deep)" stopOpacity="0.5" />
                <stop offset="94%" stopColor="var(--accent)" stopOpacity="0.42" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
              </>
            )}
          </radialGradient>

          <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>

          <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── static scaffolding ─────────────────────────────────────────── */}
        <circle cx="100" cy="100" r="92" fill="none" stroke="var(--border-hairline)" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="84" fill="none" stroke="var(--border-hairline)" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="var(--border-hairline)" strokeWidth="0.5" />

        {/* graticule ticks */}
        <g stroke="var(--accent-edge)" strokeWidth="0.75" opacity="0.5">
          {Array.from({ length: 36 }, (_, i) => {
            const long = i % 3 === 0;
            const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
            const r1 = long ? 88 : 90;
            return (
              <line
                key={i}
                x1={100 + Math.cos(a) * r1}
                y1={100 + Math.sin(a) * r1}
                x2={100 + Math.cos(a) * 92}
                y2={100 + Math.sin(a) * 92}
              />
            );
          })}
        </g>

        {/* ── rotating rings ─────────────────────────────────────────────── */}
        <circle
          className="core-ring-outer"
          cx="100"
          cy="100"
          r="88"
          fill="none"
          stroke={`url(#${uid}-sweep)`}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="120 433"
        />
        <circle
          className="core-ring-mid"
          cx="100"
          cy="100"
          r="73"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.75"
          strokeOpacity="0.45"
          strokeDasharray="4 10"
        />
        <circle
          className="core-ring-inner"
          cx="100"
          cy="100"
          r="48"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
          strokeOpacity="0.3"
          strokeDasharray="26 14 6 14"
        />

        {/* ── emitted pulse ──────────────────────────────────────────────── */}
        <circle
          className="core-pulse-ring"
          cx="100"
          cy="100"
          r="36"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.25"
        />

        {/* ── nucleus ────────────────────────────────────────────────────── */}
        <g className="core-nucleus">
          <circle cx="100" cy="100" r="34" fill={`url(#${uid}-nucleus)`} />
          <circle
            cx="100"
            cy="100"
            r="34"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="0.75"
            strokeOpacity="0.7"
          />
          {/* Inner shell ring — brightens with activity. */}
          <circle
            cx="100"
            cy="100"
            r="26"
            fill="none"
            stroke="var(--accent-bright)"
            strokeWidth="0.9"
            strokeOpacity={0.2 + energy * 0.55}
            filter={`url(#${uid}-glow)`}
          />
        </g>

        {/* ── orbiting repo nodes ────────────────────────────────────────── */}
        {orbits.map((orbit, oi) => (
          <g
            key={oi}
            className="core-orbit"
            style={
              {
                animationDuration: `${orbit.duration}s`,
                animationDirection: orbit.direction < 0 ? "reverse" : "normal",
              } as React.CSSProperties
            }
          >
            {orbit.nodes.map((node, i) => {
              const p = pointOnCircle(i, orbit.nodes.length, orbit.radius);
              const color = HEALTH_TOKEN[node.health];
              return (
                <g key={node.id} className="core-node" style={{ color }}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill={color} fillOpacity="0.18" />
                  <circle cx={p.x} cy={p.y} r="2.4" fill={color}>
                    <title>{`${node.label} — ${node.health}`}</title>
                  </circle>
                </g>
              );
            })}
          </g>
        ))}
      </svg>

      {!bare && (
        <div className="core__readout">
          <div className="core__value">{readout ?? "—"}</div>
          {readoutLabel && <div className="hud-label">{readoutLabel}</div>}
        </div>
      )}
    </div>
  );
}
