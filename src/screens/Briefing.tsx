import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type AssistantTurn, type BriefingData } from "../lib/api";
import { IconMic, IconVolume } from "../components/icons";

/**
 * Phase 7 — Daily Briefing + Voice Mode.
 *
 * The briefing is AI-generated: the Worker runs the same tool set as the
 * phase 5 assistant (metrics, errors, activity, GitHub) with a fixed prompt
 * that returns structured JSON. Five sections are displayed as HUD panels.
 *
 * Voice mode has two halves:
 *   • Read aloud  — SpeechSynthesis reads every section, or a single one.
 *   • Voice input — SpeechRecognition captures a question, sends it to the
 *                   assistant, and reads the answer back.
 *
 * Both degrade silently when the browser doesn't support the APIs. The mic
 * button is hidden when SpeechRecognition is unavailable; the speaker button
 * is hidden when SpeechSynthesis is unavailable.
 */

// Detect API support once at module load — avoids per-render checks.
const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;
const SpeechRecognitionCtor =
  typeof window !== "undefined"
    ? ((window as Record<string, unknown>).SpeechRecognition as typeof SpeechRecognition | undefined) ??
      ((window as Record<string, unknown>).webkitSpeechRecognition as
        | typeof SpeechRecognition
        | undefined)
    : undefined;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

interface SectionProps {
  label: string;
  content: string;
  tone?: "nominal" | "warn" | "critical";
  onRead?: (text: string) => void;
  canRead: boolean;
}

function BriefingSection({ label, content, tone, onRead, canRead }: SectionProps) {
  if (!content) return null;

  return (
    <div className="briefing-section panel bracket" data-tone={tone}>
      <div className="briefing-section__head">
        <span className="hud-label">{label}</span>
        {canRead && (
          <button
            className="briefing-section__speaker icon-btn"
            onClick={() => onRead?.(content)}
            title={`Read ${label} aloud`}
            aria-label={`Read ${label} aloud`}
          >
            <IconVolume />
          </button>
        )}
      </div>
      <p className="briefing-section__body">{content}</p>
    </div>
  );
}

interface ActionItemsProps {
  content: string;
  tone?: "nominal" | "warn" | "critical";
  onRead?: (text: string) => void;
  canRead: boolean;
}

function ActionItems({ content, onRead, canRead }: ActionItemsProps) {
  if (!content) return null;

  // The model outputs bullet points starting with "•" on each line.
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="briefing-section panel bracket">
      <div className="briefing-section__head">
        <span className="hud-label">Action items</span>
        {canRead && (
          <button
            className="briefing-section__speaker icon-btn"
            onClick={() => onRead?.(content)}
            title="Read action items aloud"
            aria-label="Read action items aloud"
          >
            <IconVolume />
          </button>
        )}
      </div>
      <ul className="briefing-actions">
        {lines.map((line, i) => (
          <li key={i} className="briefing-action">
            {line.startsWith("•") ? line.slice(1).trim() : line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Briefing() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // TTS state
  const [speaking, setSpeaking] = useState(false);

  // STT + inline Q&A state
  const [listening, setListening] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState<string | null>(null);
  const [voiceAnswer, setVoiceAnswer] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);

  // Keep a ref to cancel speech on unmount.
  const synthRef = useRef<typeof window.speechSynthesis | null>(null);

  useEffect(() => {
    if (hasSpeechSynthesis) synthRef.current = window.speechSynthesis;
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.briefing();
      setData(res);
    } catch (err) {
      setFetchError(err instanceof ApiError ? err.message : "Could not generate briefing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBriefing();
  }, [fetchBriefing]);

  // ── TTS ─────────────────────────────────────────────────────────────────

  function readAloud(text: string) {
    if (!hasSpeechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.96;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }

  function readAllSections() {
    if (!data) return;
    const { status, metrics, errors, shipped, action } = data.sections;
    const parts = [
      status && `Status: ${status}`,
      metrics && `Metrics: ${metrics}`,
      errors && `Errors: ${errors}`,
      shipped && `Shipped: ${shipped}`,
      action && `Action items: ${action}`,
    ].filter(Boolean);
    readAloud(parts.join(". "));
  }

  function stopSpeaking() {
    if (!hasSpeechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  // ── STT (voice input → assistant) ────────────────────────────────────────

  function startListening() {
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = "en-US";
    rec.interimResults = false;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript.trim();
      setVoiceQuery(transcript);
      setListening(false);
      void askAssistant(transcript);
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    rec.start();
    setListening(true);
    setVoiceQuery(null);
    setVoiceAnswer(null);
  }

  async function askAssistant(question: string) {
    setVoiceBusy(true);
    setVoiceAnswer(null);
    const turns: AssistantTurn[] = [{ role: "user", content: question }];
    try {
      const res = await api.assistant(turns);
      setVoiceAnswer(res.reply);
      readAloud(res.reply);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not get an answer.";
      setVoiceAnswer(msg);
    } finally {
      setVoiceBusy(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────

  const sections = data?.sections;

  // Infer a status tone from the content so we can colour the status section.
  const statusTone = (() => {
    if (!sections?.status) return undefined;
    const lower = sections.status.toLowerCase();
    if (lower.includes("critical") || lower.includes("incident") || lower.includes("down")) {
      return "critical" as const;
    }
    if (lower.includes("warn") || lower.includes("degraded") || lower.includes("errors")) {
      return "warn" as const;
    }
    return "nominal" as const;
  })();

  return (
    <div className="screen briefing-screen">
      {/* ── head ────────────────────────────────────────────────────────── */}
      <div className="screen__head briefing-head">
        <div className="briefing-head__text">
          <h1 className="screen__title">Daily Briefing</h1>
          {data && (
            <p className="screen__sub">
              {formatDate(data.generatedAt)} · generated at {formatTime(data.generatedAt)}
            </p>
          )}
          {!data && !loading && (
            <p className="screen__sub">What shipped, what broke, what to do next.</p>
          )}
        </div>

        <div className="briefing-head__controls">
          {/* Read all aloud / stop */}
          {hasSpeechSynthesis && data && (
            <button
              className="btn"
              data-variant={speaking ? "danger" : "ghost"}
              onClick={speaking ? stopSpeaking : readAllSections}
              disabled={loading}
            >
              <IconVolume />
              {speaking ? "Stop" : "Read aloud"}
            </button>
          )}

          {/* Mic — voice question to assistant */}
          {SpeechRecognitionCtor && (
            <button
              className={`btn briefing-mic-btn${listening ? " briefing-mic-btn--active" : ""}`}
              data-variant={listening ? "primary" : "ghost"}
              onClick={startListening}
              disabled={listening || voiceBusy}
              aria-label={listening ? "Listening…" : "Ask a question"}
              title={listening ? "Listening…" : "Ask a question by voice"}
            >
              <IconMic />
              {listening ? "Listening…" : voiceBusy ? "Thinking…" : "Ask"}
            </button>
          )}

          {/* Regenerate */}
          <button
            className="btn"
            data-variant="ghost"
            onClick={() => void fetchBriefing()}
            disabled={loading}
          >
            {loading ? "Generating…" : "Regenerate"}
          </button>
        </div>
      </div>

      {/* ── error ───────────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="alert" role="alert">
          <span>{fetchError}</span>
        </div>
      )}

      {/* ── loading placeholder ──────────────────────────────────────────── */}
      {loading && (
        <div className="briefing-loading">
          <div className="dot" style={{ color: "var(--accent)" }} />
          <span className="hud-label">Generating briefing… reading metrics, errors, activity</span>
        </div>
      )}

      {/* ── briefing grid ────────────────────────────────────────────────── */}
      {sections && !loading && (
        <div className="briefing-grid">
          <div className="briefing-col">
            <BriefingSection
              label="Status"
              content={sections.status}
              tone={statusTone}
              onRead={readAloud}
              canRead={hasSpeechSynthesis}
            />
            <BriefingSection
              label="Metrics"
              content={sections.metrics}
              onRead={readAloud}
              canRead={hasSpeechSynthesis}
            />
            <BriefingSection
              label="Errors"
              content={sections.errors}
              onRead={readAloud}
              canRead={hasSpeechSynthesis}
            />
          </div>

          <div className="briefing-col">
            <BriefingSection
              label="Shipped"
              content={sections.shipped}
              onRead={readAloud}
              canRead={hasSpeechSynthesis}
            />
            <ActionItems
              content={sections.action}
              onRead={readAloud}
              canRead={hasSpeechSynthesis}
            />
          </div>
        </div>
      )}

      {/* ── voice Q&A panel ─────────────────────────────────────────────── */}
      {(voiceQuery || voiceBusy) && (
        <div className="briefing-voice-qa panel bracket">
          <div className="hud-label">Voice</div>
          {voiceQuery && (
            <div className="briefing-voice-qa__turn" data-role="user">
              <span className="briefing-voice-qa__from">You</span>
              {voiceQuery}
            </div>
          )}
          {voiceBusy && (
            <div className="briefing-voice-qa__turn briefing-voice-qa__turn--pending">
              <span className="briefing-voice-qa__from">JARVIS</span>
              <span className="hud-label">Reading…</span>
            </div>
          )}
          {voiceAnswer && !voiceBusy && (
            <div className="briefing-voice-qa__turn" data-role="assistant">
              <span className="briefing-voice-qa__from">JARVIS</span>
              {voiceAnswer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
