import type { Env } from "./env";
import { json, fail, mergeHeaders, SECURITY_HEADERS } from "./http";
import {
  authConfig,
  devLogin,
  githubCallback,
  githubStart,
  logout,
  misroutedCallback,
  GITHUB_CALLBACK_PATH,
  GITHUB_CALLBACK_PATH_TRANSPOSED,
  GITHUB_START_PATH,
} from "./auth";
import { getViewer } from "./session";
import { hasRole } from "./roles";
import { pruneRateLimits, rateLimit } from "./ratelimit";
import {
  handleCore,
  handleCreateProject,
  handleDeleteProject,
  handleGetProject,
  handleListProjects,
  handleOverview,
  handleRecordMetrics,
  handleUpdateProject,
} from "./api";

/**
 * Route table. Anything not listed as public requires an authenticated viewer
 * holding the `owner` role — enforced here, in the Worker, and nowhere else.
 */
const PUBLIC_ROUTES = new Set([
  "GET /api/health",
  "GET /api/auth/config",
  `GET ${GITHUB_START_PATH}`,
  `GET ${GITHUB_CALLBACK_PATH}`,
  `GET ${GITHUB_CALLBACK_PATH_TRANSPOSED}`,
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
  const url = new URL(request.url);

  if (route === "GET /api/health") {
    return json({ ok: true, app: env.APP_NAME ?? "JARVIS", phase: 2 });
  }

  if (route === "GET /api/auth/config") return authConfig(env);
  if (route === `GET ${GITHUB_START_PATH}`) return githubStart(env, request);
  if (route === `GET ${GITHUB_CALLBACK_PATH}`) {
    ctx.waitUntil(pruneRateLimits(env));
    return githubCallback(env, request);
  }
  if (route === `GET ${GITHUB_CALLBACK_PATH_TRANSPOSED}`) {
    return misroutedCallback(env, request);
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

  if (route === "GET /api/core") return handleCore(env);
  if (route === "GET /api/overview") return handleOverview(env);

  // ── project registry ────────────────────────────────────────────────────
  if (route === "GET /api/projects") return handleListProjects(env);
  if (route === "POST /api/projects") {
    const limit = await rateLimit(env, "write", viewer.id, 120, 60);
    if (!limit.allowed) return fail(429, "rate_limited", "Slow down.");
    return handleCreateProject(env, request, viewer);
  }

  // /api/projects/:id and /api/projects/:id/metrics
  const projectMatch = url.pathname.match(
    /^\/api\/projects\/([0-9a-fA-F-]{36})(\/metrics)?$/,
  );
  if (projectMatch) {
    const [, projectId, metricsSuffix] = projectMatch;

    if (metricsSuffix) {
      if (request.method !== "POST") {
        return fail(405, "method_not_allowed", "Use POST to record metrics.");
      }
      const limit = await rateLimit(env, "write", viewer.id, 120, 60);
      if (!limit.allowed) return fail(429, "rate_limited", "Slow down.");
      return handleRecordMetrics(env, request, projectId, viewer);
    }

    switch (request.method) {
      case "GET":
        return handleGetProject(env, projectId);
      case "PATCH": {
        const limit = await rateLimit(env, "write", viewer.id, 120, 60);
        if (!limit.allowed) return fail(429, "rate_limited", "Slow down.");
        return handleUpdateProject(env, request, projectId, viewer);
      }
      case "DELETE": {
        const limit = await rateLimit(env, "write", viewer.id, 120, 60);
        if (!limit.allowed) return fail(429, "rate_limited", "Slow down.");
        return handleDeleteProject(env, projectId, viewer);
      }
      default:
        return fail(405, "method_not_allowed", "Unsupported method.");
    }
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
