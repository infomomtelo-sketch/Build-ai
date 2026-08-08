import { useEffect, useState } from "react";
import { CoreOrb } from "../components/CoreOrb";
import { IconGithub } from "../components/icons";
import { api, ApiError, AUTH_ERROR_COPY, type AuthConfig } from "../lib/api";

interface LoginProps {
  config: AuthConfig | null;
  onAuthenticated: () => void;
}

export function Login({ config, onAuthenticated }: LoginProps) {
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  // The OAuth callback reports failures by redirecting back with ?error=…
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (!code) return;
    setError(AUTH_ERROR_COPY[code] ?? "Sign-in failed. Try again.");
    window.history.replaceState({}, "", "/login");
  }, []);

  async function submitDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.devLogin(email);
      onAuthenticated();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Sign-in failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login__inner">
        <div className="login__core">
          <CoreOrb activity={0.22} nodes={[]} bare />
        </div>

        <div className="login__brand">
          <div className="login__name">JARVIS</div>
          <div className="login__tag">Every build. One console.</div>
        </div>

        <div className="panel bracket login__card">
          {error && (
            <div className="alert" role="alert">
              <span>{error}</span>
            </div>
          )}

          {config?.githubEnabled ? (
            <a className="btn" data-variant="primary" href="/api/auth/github/start">
              <IconGithub className="nav__glyph" />
              Authenticate with GitHub
            </a>
          ) : (
            <div className="alert" data-tone="warn" role="status">
              <span>
                GitHub sign-in is not configured yet. Set{" "}
                <span className="mono">GITHUB_CLIENT_ID</span>,{" "}
                <span className="mono">GITHUB_CLIENT_SECRET</span>,{" "}
                <span className="mono">SESSION_SECRET</span> and{" "}
                <span className="mono">OWNER_EMAILS</span> as Worker secrets.
              </span>
            </div>
          )}

          {config?.devLoginEnabled && (
            <>
              <div className="divider">local dev only</div>
              <form className="field" onSubmit={submitDevLogin}>
                <label className="hud-label" htmlFor="dev-email">
                  Owner email
                </label>
                <input
                  id="dev-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Verifying…" : "Enter console"}
                </button>
              </form>
            </>
          )}

          <p className="login__hint">
            Single-operator console. Access is checked against a server-side owner
            allowlist — the list never reaches this page.
          </p>
        </div>
      </div>
    </div>
  );
}
