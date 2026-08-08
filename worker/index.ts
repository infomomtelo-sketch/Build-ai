import type { Env } from "./env";
import { json, fail, mergeHeaders, SECURITY_HEADERS } from "./http";
import { authConfig, devLogin, githubCallback, githubStart, logout } from "./auth";
import { getViewer } from "./session";
import { hasRole } from "./roles";
import { pruneRateLimits } from "./ratelimit";

/**
 * Route table. Anything not listed as public requires an authenticated viewer
 * holding the `owner` role — enforced here, in the Worker, and nowhere else.
 */
const PUBLIC_ROUTES = new Set([
  "GET /api/health",
  "GET /api/auth/config",
  "GET /api/auth/github/start",
  "GET /api/auth/github/callback",
  "POST /api/auth/dev-login",
  "POST /api/auth/logout",
]);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    const route = `${request.method} ${url.pathname}`;

    try {
      const response = await handleApi(route, request, env, ctx);
      return withSecurityHeaders(response);
    } catch (err) {
      // Never leak internals — the message could name a secret or a table.
      console.error("unhandled_error", err instanceof Error ? err.message : String(err));
      return withSecurityHeaders(
        fail(500, "internal_error", "Something went wrong. The incident was logged."),
      );
    }
  },
} satisfies ExportedHandler<Env>;

async function handleApi(
  route: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (route === "GET /api/health") {
    return json({ ok: true, app: env.APP_NAME ?? "JARVIS", phase: 1 });
  }

  if (route === "GET /api/auth/config") return authConfig(env);
  if (route === "GET /api/auth/github/start") return githubStart(env, request);
  if (route === "GET /api/auth/github/callback") {
    ctx.waitUntil(pruneRateLimits(env));
    return githubCallback(env, request);
  }
  if (route === "POST /api/auth/dev-login") return devLogin(env, request);
  if (route === "POST /api/auth/logout") return logout(env, request);

  // ── everything past this line is owner-only ─────────────────────────────
  if (PUBLIC_ROUTES.has(route)) {
    return fail(404, "not_found", "No such endpoint.");
  }

  const viewer = await getViewer(env, request);
  if (!viewer) {
    return fail(401, "unauthenticated", "Sign in required.");
  }
  if (!(await hasRole(env, viewer.id, "owner"))) {
    return fail(403, "forbidden", "Owner role required.");
  }

  if (route === "GET /api/me") {
    // Identity only. No tokens, no allowlist, no secrets.
    return json({
      id: viewer.id,
      email: viewer.email,
      displayName: viewer.displayName,
      avatarUrl: viewer.avatarUrl,
      githubLogin: viewer.githubLogin,
      roles: viewer.roles,
    });
  }

  if (route === "GET /api/core") {
    // Phase 1: the core orb runs on a real endpoint with placeholder telemetry.
    // Phase 2 replaces this with the project registry; the shape stays.
    return json({
      activity: 0,
      nodes: [],
      phase: 1,
      message: "Project registry lands in phase 2.",
    });
  }

  return fail(404, "not_found", "No such endpoint.");
}

function withSecurityHeaders(response: Response): Response {
  const headers = mergeHeaders(new Headers(), response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
