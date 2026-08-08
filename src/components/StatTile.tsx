import type { ReactNode } from "react";
import { Sparkline, type SparkPoint } from "./Sparkline";

interface StatTileProps {
  label: string;
  value: string;
  /** Small qualifier under the value — units, window, or provenance. */
  caption?: string;
  points?: SparkPoint[];
  format?: (v: number) => string;
  /** Renders in place of the sparkline when the measure isn't live yet. */
  placeholder?: ReactNode;
}

/**
 * A headline number. The value wears text tokens, never a series colour — the
 * sparkline beneath carries the colour and the trend.
 */
export function StatTile({
  label,
  value,
  caption,
  points,
  format,
  placeholder,
}: StatTileProps) {
  return (
    <div className="panel bracket tile">
      <div className="hud-label">{label}</div>
      <div className="tile__value mono">{value}</div>
      {caption && <div className="tile__caption">{caption}</div>}

      <div className="tile__plot">
        {placeholder ??
          (points && format ? (
            <Sparkline points={points} format={format} label={label} />
          ) : null)}
      </div>
    </div>
  );
}
