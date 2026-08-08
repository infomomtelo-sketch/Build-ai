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

export const api = {
  authConfig: () => request<AuthConfig>("/api/auth/config"),

  me: () => request<Viewer>("/api/me"),

  core: () => request<CoreTelemetry>("/api/core"),

  devLogin: (email: string) =>
    request<{ ok: true }>("/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
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
