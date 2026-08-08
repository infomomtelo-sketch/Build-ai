import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { Login } from "./screens/Login";
import { Overview } from "./screens/Overview";
import { PhasePending } from "./screens/PhasePending";
import { entryForPath, SHIPPED_THROUGH } from "./lib/nav";
import { api, ApiError, type AuthConfig, type CoreTelemetry, type Viewer } from "./lib/api";

type AuthState =
  | { status: "booting" }
  | { status: "anonymous"; config: AuthConfig | null }
  | { status: "authenticated"; viewer: Viewer };

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "booting" });
  const [path, setPath] = useState(window.location.pathname);
  const [telemetry, setTelemetry] = useState<CoreTelemetry | null>(null);

  // Identity is resolved by asking the server, never by reading storage. There
  // is nothing in localStorage or in client code that grants access.
  const resolveViewer = useCallback(async () => {
    try {
      const viewer = await api.me();
      setAuth({ status: "authenticated", viewer });
      if (window.location.pathname === "/login") {
        window.history.replaceState({}, "", "/");
        setPath("/");
      }
    } catch (err) {
      if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) {
        console.error("identity check failed", err);
      }
      const config = await api.authConfig().catch(() => null);
      setAuth({ status: "anonymous", config });
    }
  }, []);

  useEffect(() => {
    void resolveViewer();
  }, [resolveViewer]);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Core telemetry only exists for an authenticated owner.
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;

    const load = async () => {
      const data = await api.core().catch(() => null);
      if (!cancelled && data) setTelemetry(data);
    };

    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [auth.status]);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setTelemetry(null);
    window.history.replaceState({}, "", "/login");
    setPath("/login");
    setAuth({ status: "anonymous", config: await api.authConfig().catch(() => null) });
  }, []);

  if (auth.status === "booting") {
    return (
      <div className="boot">
        <div className="boot__text">Initialising core…</div>
      </div>
    );
  }

  if (auth.status === "anonymous") {
    return <Login config={auth.config} onAuthenticated={() => void resolveViewer()} />;
  }

  const entry = entryForPath(path);

  return (
    <AppShell
      viewer={auth.viewer}
      current={entry}
      onNavigate={navigate}
      onLogout={() => void logout()}
    >
      {entry.phase <= SHIPPED_THROUGH ? (
        <Overview viewer={auth.viewer} telemetry={telemetry} />
      ) : (
        <PhasePending entry={entry} />
      )}
    </AppShell>
  );
}
