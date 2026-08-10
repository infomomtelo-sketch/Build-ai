export interface Viewer {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubLogin: string | null;
  roles: string[];
}

export interface AuthConfig {
  githubEnabled: boolean;
  devLoginEnabled: boolean;
  environment: string;
}

export interface CoreTelemetry {
  activity: number;
  nodes: { id: string; label: string; health: "nominal" | "warn" | "critical" | "idle" }[];
  phase: number;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      res.status,
      body?.error?.code ?? "unknown",
      body?.error?.message ?? `Request failed (${res.status})`,
    );
  }

  return (await res.json()) as T;
}

export type Health = "nominal" | "warn" | "critical" | "idle";
export type ProjectStatus = "active" | "paused" | "archived";

export interface ProjectLatest {
  day: string;
  mrrCents: number;
  users: number;
  errors: number;
  uptimePct: number | null;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  stack: string | null;
  repoFullName: string | null;
  health: Health;
  status: ProjectStatus;
  notes: string | null;
  lastDeployAt: string | null;
  createdAt: string;
  latest: ProjectLatest | null;
}

export interface MetricPoint {
  day: string;
  mrrCents: number;
  users: number;
  signups: number;
  deploys: number;
  errors: number;
  uptimePct: number | null;
  source: string;
}

export interface OverviewEvent {
  id: number;
  at: string;
  kind: string;
  severity: "info" | "warn" | "critical";
  message: string;
  projectName: string | null;
}

export interface Overview {
  totals: {
    mrrCents: number;
    users: number;
    signups7: number;
    deploys7: number;
    errors: number;
    projects: number;
    activeIncidents: number | null;
  };
  byHealth: Record<Health, number>;
  series: { day: string; mrrCents: number; users: number; signups: number; deploys: number }[];
  projects: {
    id: string;
    name: string;
    health: Health;
    domain: string | null;
    mrrCents: number | null;
    users: number | null;
    lastMetricDay: string | null;
  }[];
  events: OverviewEvent[];
}

export interface ProjectInput {
  name: string;
  domain?: string | null;
  stack?: string | null;
  repoFullName?: string | null;
  health?: Health;
  status?: ProjectStatus;
  notes?: string | null;
}

export interface MetricsInput {
  day?: string;
  mrr?: string | number;
  users?: string | number;
  signups?: string | number;
  deploys?: string | number;
  errors?: string | number;
  uptimePct?: string | number | null;
}

export interface ErrorGroup {
  fingerprint: string;
  message: string;
  count: number;
  affectedSessions: number;
  firstSeen: string;
  lastSeen: string;
  impactScore: number;
  resolved: boolean;
}

export interface ErrorDetail extends ErrorGroup {
  stackTrace: string | null;
  context: Record<string, unknown> | null;
}

export const api = {
  authConfig: () => request<AuthConfig>("/api/auth/config"),

  me: () => request<Viewer>("/api/me"),

  core: () => request<CoreTelemetry>("/api/core"),

  overview: () => request<Overview>("/api/overview"),

  projects: () => request<{ projects: Project[] }>("/api/projects"),

  project: (id: string) =>
    request<{ project: Project; metrics: MetricPoint[] }>(`/api/projects/${id}`),

  createProject: (input: ProjectInput) =>
    request<{ project: Project }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateProject: (id: string, input: Partial<ProjectInput>) =>
    request<{ project: Project }>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteProject: (id: string) =>
    request<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),

  recordMetrics: (id: string, input: MetricsInput) =>
    request<{ ok: true; day: string }>(`/api/projects/${id}/metrics`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  devLogin: (email: string) =>
    request<{ ok: true }>("/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  repoList: () =>
    request<{ repos: string[] }>("/api/github/repos"),

  repoTree: (repo: string, path?: string) =>
    request<{ tree: any[] }>(`/api/github/repos/${repo}/tree${path ? `?path=${encodeURIComponent(path)}` : ""}`),

  repoCommits: (repo: string) =>
    request<{ commits: any[] }>(`/api/github/repos/${repo}/commits`),

  repoFile: (repo: string, path: string) =>
    request<{ file: any }>(`/api/github/repos/${repo}/file?path=${encodeURIComponent(path)}`),

  projectErrors: (projectId: string) =>
    request<{ errors: ErrorGroup[] }>(`/api/projects/${projectId}/errors`),

  errorGroup: (projectId: string, fingerprint: string) =>
    request<{ group: ErrorDetail }>(`/api/projects/${projectId}/errors/${fingerprint}`),

  resolveError: (projectId: string, fingerprint: string) =>
    request<{ ok: true }>(`/api/projects/${projectId}/errors/${fingerprint}`, {
      method: "PATCH",
    }),
};

/** Human-readable text for the error codes the auth redirect can hand back. */
export const AUTH_ERROR_COPY: Record<string, string> = {
  not_allowlisted:
    "That account is not on the owner allowlist. JARVIS is a single-operator console.",
  oauth_not_configured:
    "GitHub sign-in is not configured on this deployment. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
  token_exchange_failed: "GitHub rejected the sign-in exchange. Try again.",
  github_user_failed: "Could not read your GitHub profile. Try again.",
  no_verified_email: "Your GitHub account has no verified email address.",
  bad_state: "Sign-in session expired or was tampered with. Start again.",
  missing_code: "GitHub did not return an authorization code.",
  rate_limited: "Too many sign-in attempts. Wait a few minutes.",
  callback_path_mismatch:
    "Your GitHub OAuth app points at /api/auth/callback/github. The correct " +
    "callback is /api/auth/github/callback — update the app and try again.",
};
