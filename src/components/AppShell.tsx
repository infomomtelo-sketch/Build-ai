import type { ReactNode } from "react";
import type { Viewer } from "../lib/api";
import { NAV, SHIPPED_THROUGH, type NavEntry } from "../lib/nav";
import { IconLogout, IconMark } from "./icons";
import { AssistantDock } from "./AssistantDock";

interface AppShellProps {
  viewer: Viewer;
  current: NavEntry;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({
  viewer,
  current,
  onNavigate,
  onLogout,
  children,
}: AppShellProps) {
  const initials = (viewer.displayName ?? viewer.email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return (
    <div className="shell">
      <nav className="shell__rail" aria-label="Primary">
        <div className="brand">
          <IconMark className="brand__mark" />
          <div className="brand__text">
            <div className="brand__name">JARVIS</div>
            <div className="brand__tag">Every build. One console.</div>
          </div>
        </div>

        <div className="nav">
          {NAV.map((entry) => {
            const Glyph = entry.icon;
            const live = entry.phase <= SHIPPED_THROUGH;
            return (
              <button
                key={entry.id}
                className="nav__item"
                aria-current={entry.id === current.id ? "page" : undefined}
                onClick={() => onNavigate(entry.path)}
              >
                <Glyph className="nav__glyph" />
                <span className="nav__label">{entry.label}</span>
                {!live && <span className="nav__phase">P{entry.phase}</span>}
              </button>
            );
          })}
        </div>

        <div className="rail-footer">
          <div className="avatar">
            {viewer.avatarUrl ? (
              <img src={viewer.avatarUrl} alt="" />
            ) : (
              <span>{initials || "??"}</span>
            )}
          </div>
          <div className="rail-footer__meta">
            <div className="hud-label">{viewer.roles[0] ?? "no role"}</div>
            <div className="rail-footer__email" title={viewer.email}>
              {viewer.email}
            </div>
          </div>
          <button className="icon-btn" onClick={onLogout} title="Sign out" aria-label="Sign out">
            <IconLogout />
          </button>
        </div>
      </nav>

      <header className="shell__topbar">
        <div className="breadcrumb">
          <span className="hud-label">{current.label}</span>
          <span className="breadcrumb__title">{current.title}</span>
          {current.phase > SHIPPED_THROUGH && (
            <span className="chip" data-tone="idle">
              Phase {current.phase}
            </span>
          )}
        </div>

        <div className="topbar__stats">
          <div className="stat-inline">
            <span className="hud-label">Session</span>
            <span className="stat-inline__value">owner</span>
          </div>
          <div className="stat-inline">
            <span className="hud-label">Phase</span>
            <span className="stat-inline__value">{SHIPPED_THROUGH} / 7</span>
          </div>
          <span className="chip" data-tone="nominal">
            <span className="dot" />
            Online
          </span>
        </div>
      </header>

      <main className="shell__main">{children}</main>

      <AssistantDock />
    </div>
  );
}
