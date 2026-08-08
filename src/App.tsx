import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { Login } from "./screens/Login";
import { Overview } from "./screens/Overview";
import { Projects } from "./screens/Projects";
import { ProjectDetail } from "./screens/ProjectDetail";
import { PhasePending } from "./screens/PhasePending";
import { NAV, SHIPPED_THROUGH, entryForPath } from "./lib/nav";
import {
  api,
  ApiError,
  type AuthConfig,
  type CoreTelemetry,
  type Overview as OverviewData,
  type Project,
  type Viewer,
} from "./lib/api";

type AuthState =
  | { status: "booting" }
  | { status: "anonymous"; config: AuthConfig | null }
  | { status: "authenticated"; viewer: Viewer };

/** `/projects/<uuid>` → the id, else null. */
function projectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/projects\/([0-9a-fA-F-]{36})$/);
  return m ? m[1] : null;
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "booting" });
  const [path, setPath] = useState(window.location.pathname);

  const [telemetry, setTelemetry] = useState<CoreTelemetry | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [composing, setComposing] = useState(false);

  // Identity comes from the server, never from storage.
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

  const refresh = useCallback(async () => {
    const [core, wall, list] = await Promise.all([
      api.core().catch(() => null),
      api.overview().catch(() => null),
      api.projects().catch(() => null),
    ]);
    if (core) setTelemetry(core);
    if (wall) setOverview(wall);
    if (list) setProjects(list.projects);
    setLoadingProjects(false);
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [auth.status, refresh]);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setTelemetry(null);
    setOverview(null);
    setProjects([]);
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

  const detailId = projectIdFromPath(path);
  const entry = detailId ? NAV.find((n) => n.id === "projects")! : entryForPath(path);

  const openProject = (id: string) => navigate(`/projects/${id}`);
  const startCompose = () => {
    navigate("/projects");
    setComposing(true);
  };

  let screen;
  if (detailId) {
    screen = (
      <ProjectDetail
        projectId={detailId}
        onBack={() => navigate("/projects")}
        onChanged={() => void refresh()}
      />
    );
  } else if (entry.id === "overview") {
    screen = (
      <Overview
        viewer={auth.viewer}
        telemetry={telemetry}
        data={overview}
        onOpenProject={openProject}
        onAddProject={startCompose}
      />
    );
  } else if (entry.id === "projects") {
    screen = (
      <Projects
        projects={projects}
        loading={loadingProjects}
        composing={composing}
        onCompose={setComposing}
        onChanged={() => void refresh()}
        onOpenProject={openProject}
      />
    );
  } else if (entry.phase <= SHIPPED_THROUGH) {
    screen = <PhasePending entry={entry} />;
  } else {
    screen = <PhasePending entry={entry} />;
  }

  return (
    <AppShell
      viewer={auth.viewer}
      current={entry}
      onNavigate={navigate}
      onLogout={() => void logout()}
    >
      {screen}
    </AppShell>
  );
}
