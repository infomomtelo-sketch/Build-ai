import { useId, useMemo, useState } from "react";
import { dayLabel } from "../lib/format";

export interface SparkPoint {
  day: string;
  value: number;
}

interface SparklineProps {
  points: SparkPoint[];
  /** Formats the hovered value for the tooltip. */
  format: (v: number) => string;
  label: string;
}

const W = 240;
const H = 44;
const PAD = 3;

/**
 * Single-series sparkline. One measure, one line — no second axis, no legend
 * (the tile's title names the series). Carries a hover readout because it is a
 * plot, not a bare number.
 */
export function Sparkline({ points, format, label }: SparklineProps) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (points.length < 2) return null;

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // A flat series draws through the middle rather than dividing by zero.
    const span = max - min || 1;
    const flat = max === min;

    const xs = points.map((_, i) => PAD + (i / (points.length - 1)) * (W - PAD * 2));
    const ys = points.map((p) =>
      flat ? H / 2 : H - PAD - ((p.value - min) / span) * (H - PAD * 2),
    );

    const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("");
    const area = `${line}L${xs[xs.length - 1].toFixed(1)},${H}L${xs[0].toFixed(1)},${H}Z`;

    return { xs, ys, line, area, min, max };
  }, [points]);

  if (!geom) {
    return (
      <div className="spark spark--empty">
        <span className="hud-label">Not enough data</span>
      </div>
    );
  }

  const active = hover ?? points.length - 1;

  return (
    <div className="spark">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="spark__svg"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${format(points[points.length - 1].value)} on ${dayLabel(points[points.length - 1].day)}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(ratio * (points.length - 1));
          setHover(Math.min(points.length - 1, Math.max(0, idx)));
        }}
      >
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={geom.area} fill={`url(#${uid}-fill)`} />
        <path
          d={geom.line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {hover !== null && (
          <line
            x1={geom.xs[active]}
            y1={0}
            x2={geom.xs[active]}
            y2={H}
            stroke="var(--border-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Surface ring keeps the marker readable where it sits on the line. */}
        <circle
          cx={geom.xs[active]}
          cy={geom.ys[active]}
          r="3.5"
          fill="var(--accent)"
          stroke="var(--surface-panel)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="spark__readout mono" aria-live="off">
        {hover === null ? (
          <span className="spark__hint">{dayLabel(points[0].day)} — {dayLabel(points[points.length - 1].day)}</span>
        ) : (
          <span>
            {dayLabel(points[active].day)} · {format(points[active].value)}
          </span>
        )}
      </div>
    </div>
  );
}
