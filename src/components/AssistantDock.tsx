import { useEffect, useRef, useState } from "react";
import { api, ApiError, type AssistantTurn } from "../lib/api";

/**
 * The assistant is docked on every screen so the layout is honest about where
 * it lives. Phase 5 gives it read-only tools — query_metrics, summarize_errors,
 * recent_activity, read_file, search_repo. Write actions (open_pr, run_deploy,
 * rollback) arrive in phase 6, each behind a diff confirmation.
 */
export function AssistantDock() {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the transcript grows.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [turns, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    // Send the history as it stands *before* this turn is appended locally, so
    // the server sees exactly one trailing user message.
    const next: AssistantTurn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const res = await api.assistant(next);
      setTurns([...next, { role: "assistant", content: res.reply }]);
    } catch (err) {
      // The failed turn stays on screen; only the reply is missing.
      setError(
        err instanceof ApiError ? err.message : "The assistant could not answer.",
      );
    } finally {
      setBusy(false);
    }
  }

  const empty = turns.length === 0;

  return (
    <aside className="shell__dock">
      <div className="dock__head">
        <span
          className="dot"
          style={{ color: busy ? "var(--accent)" : "var(--status-nominal)" }}
        />
        <span className="hud-label">Assistant</span>
        <span className="chip" style={{ marginLeft: "auto" }}>
          Read-only
        </span>
      </div>

      <div className="dock__body" ref={bodyRef}>
        {empty && (
          <div className="dock-msg">
            <div className="dock-msg__from">JARVIS</div>
            Core online. Ask me about your builds — I can read metrics, rank
            unresolved errors, check the event log, and read code from your
            repositories. I can't change anything yet; write actions land in
            phase 6.
          </div>
        )}

        {turns.map((t, i) => (
          <div
            key={i}
            className="dock-msg"
            data-role={t.role}
            // Screen readers should hear replies as they land.
            aria-live={t.role === "assistant" ? "polite" : undefined}
          >
            <div className="dock-msg__from">
              {t.role === "user" ? "You" : "JARVIS"}
            </div>
            {t.content}
          </div>
        ))}

        {busy && (
          <div className="dock-msg dock-msg--pending">
            <div className="dock-msg__from">JARVIS</div>
            <span className="hud-label">Reading…</span>
          </div>
        )}

        {error && (
          <div className="alert" role="alert">
            <span>{error}</span>
          </div>
        )}
      </div>

      <form className="dock__foot" onSubmit={send}>
        <input
          className="dock__input"
          placeholder={busy ? "Working…" : "Ask about your builds"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          aria-label="Ask the assistant"
        />
      </form>
    </aside>
  );
}
