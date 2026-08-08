/**
 * The assistant is docked on every screen from day one so the layout is honest
 * about where it lives. Its tools (read_file, search_repo, query_metrics, …)
 * arrive in phase 5; write actions and their confirmation modals in phase 6.
 */
export function AssistantDock() {
  return (
    <aside className="shell__dock">
      <div className="dock__head">
        <span className="dot" style={{ color: "var(--status-idle)" }} />
        <span className="hud-label">Assistant</span>
        <span className="chip" data-tone="idle" style={{ marginLeft: "auto" }}>
          Phase 5
        </span>
      </div>

      <div className="dock__body">
        <div className="dock-msg">
          <div className="dock-msg__from">JARVIS</div>
          Core online. Owner session verified server-side.
        </div>

        <div className="dock-msg">
          <div className="dock-msg__from">System</div>
          My tool belt lands in phase 5 — <span className="mono">read_file</span>,{" "}
          <span className="mono">search_repo</span>,{" "}
          <span className="mono">query_metrics</span>,{" "}
          <span className="mono">summarize_errors</span> as read-only, then{" "}
          <span className="mono">open_pr</span>, <span className="mono">run_deploy</span>{" "}
          and <span className="mono">rollback</span> in phase 6, each behind a diff
          confirmation.
        </div>
      </div>

      <div className="dock__foot">
        <input
          className="dock__input"
          placeholder="Assistant offline until phase 5"
          disabled
          aria-label="Assistant input, disabled until phase 5"
        />
      </div>
    </aside>
  );
}
