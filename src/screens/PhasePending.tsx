import { IconLock } from "../components/icons";
import { PHASES, type NavEntry } from "../lib/nav";

/**
 * Placeholder for a screen whose phase has not shipped. It states plainly what
 * the screen will do and what has to land first, rather than showing mock data
 * that would read as real.
 */
export function PhasePending({ entry }: { entry: NavEntry }) {
  const blockers = PHASES.filter((p) => p.n < entry.phase && p.n > 1);

  return (
    <div className="screen">
      <div className="screen__head">
        <h1 className="screen__title">{entry.title}</h1>
        <p className="screen__sub">{entry.blurb}</p>
      </div>

      <div className="panel bracket locked">
        <div className="locked__ring">
          <IconLock />
        </div>
        <div className="locked__title">Phase {entry.phase}</div>
        <p className="locked__body">
          This screen is scaffolded but deliberately empty. It ships in phase{" "}
          {entry.phase}, wired to live data — no placeholder metrics stand in for
          real ones.
        </p>

        {blockers.length > 0 && (
          <div className="phase-list">
            {blockers.map((p) => (
              <div key={p.n} className="phase-row">
                <span className="phase-row__num mono">{p.n}</span>
                <span className="phase-row__label">{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
