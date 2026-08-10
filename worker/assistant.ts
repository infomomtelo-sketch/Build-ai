import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { fail, json } from "./http";
import { getGitHubToken } from "./github";
import { listErrorGroups } from "./errors";
import {
  latestMetricsByProject,
  listProjects,
  metricsForProject,
  recentEvents,
} from "./projects";
import type { Env } from "./env";
import type { Viewer } from "./session";

/**
 * Phase 5 — the assistant reads. It does not write.
 *
 * That guarantee is structural, not a prompt instruction: every tool below is a
 * SELECT against D1 or a GET against GitHub. No tool mutates anything, so no
 * prompt injection in a project note, an error message, or a source file can
 * turn this into a writer. Write actions (PRs, deploys, rollback) arrive in
 * phase 6 and will be gated behind explicit confirmation.
 */

const MODEL = "claude-opus-5";

/**
 * Opus 5 answers registry lookups well below its default effort, and this
 * console is single-operator — medium keeps latency and spend down without
 * costing accuracy on questions this shaped. Raise it if answers get shallow.
 */
const EFFORT = "medium" as const;

/** A runaway tool loop is the expensive failure mode; bound it. */
const MAX_ITERATIONS = 8;

const SYSTEM = `You are JARVIS, the assistant inside a single-operator build command center.
The operator owns every project you can see. Answer questions about their builds
using the tools; the tools are the only source of truth about their data.

You are read-only in this phase. You cannot edit code, open pull requests, or
deploy — say so plainly if asked, and do not describe a change as if you made it.

Ground every factual claim about metrics, errors, or code in a tool result. If a
tool returns nothing, say the data is not recorded yet rather than estimating —
figures in this console are owner-entered, so a missing number means unrecorded,
not zero.

Keep responses brief and focused; most answers here are a sentence or two. Lead
with the answer, then any supporting detail. Deliver what was asked at the scope
asked — don't volunteer adjacent analysis the operator didn't request.`;

/* ── tools ──────────────────────────────────────────────────────────────────
   Each is a plain async function returning a string, so it can be exercised
   directly against D1 without an API key or a model in the loop. */

export async function queryMetrics(
  env: Env,
  input: { project?: string },
): Promise<string> {
  const projects = await listProjects(env);
  if (!projects.length) return "No projects are registered yet.";

  const wanted = input.project?.trim().toLowerCase();
  const matches = wanted
    ? projects.filter(
        (p) =>
          p.slug.toLowerCase() === wanted ||
          p.name.toLowerCase().includes(wanted),
      )
    : projects;

  if (!matches.length) {
    return `No project matches "${input.project}". Registered: ${projects
      .map((p) => p.name)
      .join(", ")}.`;
  }

  const latest = await latestMetricsByProject(env);

  const lines = matches.map((p) => {
    const m = latest.get(p.id);
    if (!m) return `${p.name} (${p.slug}) — health ${p.health}, no metrics recorded`;
    return (
      `${p.name} (${p.slug}) — health ${p.health}, as of ${m.day}: ` +
      `MRR $${(m.mrr_cents / 100).toFixed(2)}, users ${m.users}, ` +
      `signups ${m.signups}, deploys ${m.deploys}, errors ${m.errors}, ` +
      `uptime ${m.uptime_pct ?? "unrecorded"}`
    );
  });

  // A single named project gets its history too, so trend questions resolve in
  // one tool call instead of a follow-up.
  if (matches.length === 1) {
    const history = await metricsForProject(env, matches[0].id, 14);
    if (history.length > 1) {
      lines.push(
        "\nLast 14 recorded days (day, MRR cents, users, errors):",
        ...history.map(
          (h) => `  ${h.day}  ${h.mrr_cents}  ${h.users}  ${h.errors}`,
        ),
      );
    }
  }

  return lines.join("\n");
}

export async function summarizeErrors(
  env: Env,
  input: { project?: string },
): Promise<string> {
  const projects = await listProjects(env);
  if (!projects.length) return "No projects are registered yet.";

  const wanted = input.project?.trim().toLowerCase();
  const targets = wanted
    ? projects.filter(
        (p) =>
          p.slug.toLowerCase() === wanted ||
          p.name.toLowerCase().includes(wanted),
      )
    : projects;

  if (!targets.length) return `No project matches "${input.project}".`;

  const sections: string[] = [];
  for (const p of targets) {
    const groups = await listErrorGroups(env, p.id);
    if (!groups.length) {
      sections.push(`${p.name}: no unresolved errors.`);
      continue;
    }
    sections.push(
      `${p.name}: ${groups.length} unresolved group${groups.length === 1 ? "" : "s"}, ` +
        `highest impact first:`,
      ...groups
        .slice(0, 10)
        .map(
          (g) =>
            `  [impact ${g.impactScore.toFixed(2)}] ${g.count}× ` +
            `${g.affectedSessions} sessions, last ${g.lastSeen} — ${g.message}`,
        ),
    );
  }
  return sections.join("\n");
}

export async function recentActivity(env: Env): Promise<string> {
  const events = await recentEvents(env, 25);
  if (!events.length) return "No activity recorded yet.";
  return events
    .map((e) => `${e.at} [${e.severity}] ${e.project_name ?? "system"}: ${e.message}`)
    .join("\n");
}

export async function readRepoFile(
  env: Env,
  userId: string,
  input: { repo: string; path: string },
): Promise<string> {
  const token = await getGitHubToken(env, userId);
  if (!token) {
    return "GitHub is not connected for this account, so repository files cannot be read. Connecting happens on GitHub sign-in.";
  }
  const res = await fetch(
    `https://api.github.com/repos/${input.repo}/contents/${input.path}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "jarvis-build-command",
      },
    },
  );
  if (!res.ok) return `GitHub returned ${res.status} for ${input.repo}/${input.path}.`;

  const body = (await res.json()) as { type?: string; content?: string };
  if (body.type !== "file" || !body.content) {
    return `${input.path} is not a readable file.`;
  }
  const decoded = atob(body.content.replace(/\n/g, ""));
  // Truncate rather than blow the context window on a large file.
  return decoded.length > 40_000
    ? `${decoded.slice(0, 40_000)}\n\n[truncated at 40000 characters]`
    : decoded;
}

export async function searchRepo(
  env: Env,
  userId: string,
  input: { repo: string; query: string },
): Promise<string> {
  const token = await getGitHubToken(env, userId);
  if (!token) {
    return "GitHub is not connected for this account, so repository search is unavailable.";
  }
  const q = encodeURIComponent(`${input.query} repo:${input.repo}`);
  const res = await fetch(`https://api.github.com/search/code?q=${q}&per_page=20`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "jarvis-build-command",
    },
  });
  if (!res.ok) {
    return `GitHub code search returned ${res.status}. Newly pushed or private repositories are not always indexed.`;
  }
  const body = (await res.json()) as { total_count?: number; items?: { path: string }[] };
  if (!body.items?.length) return `No matches for "${input.query}" in ${input.repo}.`;
  return [
    `${body.total_count} match(es) for "${input.query}" in ${input.repo}:`,
    ...body.items.map((i) => `  ${i.path}`),
  ].join("\n");
}

/* ── the loop ───────────────────────────────────────────────────────────── */

interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export async function handleAssistant(
  env: Env,
  request: Request,
  viewer: Viewer,
): Promise<Response> {
  let body: { messages?: AssistantTurn[] };
  try {
    body = (await request.json()) as { messages?: AssistantTurn[] };
  } catch {
    return fail(400, "bad_request", "Expected a JSON body.");
  }

  const turns = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  if (!turns.length) return fail(400, "bad_request", "At least one message is required.");
  if (turns.at(-1)!.role !== "user") {
    return fail(400, "bad_request", "The last message must be from the user.");
  }

  // Checked after validation so a malformed request reads as a client error
  // rather than being masked by server configuration.
  if (!env.ANTHROPIC_API_KEY) {
    return fail(
      503,
      "not_configured",
      "The assistant needs ANTHROPIC_API_KEY set as a Worker secret.",
    );
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const tools = [
    betaTool({
      name: "query_metrics",
      description:
        "Read registered projects with their latest owner-entered metrics (MRR, users, signups, deploys, errors, uptime) and health. Call with no project to survey everything, or with a project name or slug to get that project plus its recent daily history. Use this for any question about numbers, health, or which projects exist.",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "Project name or slug. Omit to return every project.",
          },
        },
      },
      run: (input) => queryMetrics(env, input as { project?: string }),
    }),
    betaTool({
      name: "summarize_errors",
      description:
        "Read unresolved error groups, ranked by user impact (frequency, affected sessions, recency). Call with no project to sweep every project, or with a name or slug to scope it. Use this for anything about failures, crashes, incidents, or what to fix next.",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description: "Project name or slug. Omit to cover every project.",
          },
        },
      },
      run: (input) => summarizeErrors(env, input as { project?: string }),
    }),
    betaTool({
      name: "recent_activity",
      description:
        "Read the console's rolling event log — registry changes, recorded metrics, and other logged activity, newest first. Use this for 'what changed' or 'what happened recently' questions.",
      inputSchema: { type: "object", properties: {} },
      run: () => recentActivity(env),
    }),
    betaTool({
      name: "read_file",
      description:
        "Read one file from a GitHub repository the operator owns. Requires the repository's full name (owner/repo) and a path within it. Returns file contents, truncated if very large.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full name, e.g. owner/repo." },
          path: { type: "string", description: "Path within the repository." },
        },
        required: ["repo", "path"],
      },
      run: (input) =>
        readRepoFile(env, viewer.id, input as { repo: string; path: string }),
    }),
    betaTool({
      name: "search_repo",
      description:
        "Search code inside one GitHub repository the operator owns and return matching file paths. Use it to locate where something lives before reading it with read_file.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full name, e.g. owner/repo." },
          query: { type: "string", description: "Text to search for in the code." },
        },
        required: ["repo", "query"],
      },
      run: (input) =>
        searchRepo(env, viewer.id, input as { repo: string; query: string }),
    }),
  ];

  try {
    const message = await client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: EFFORT },
      tools,
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
      max_iterations: MAX_ITERATIONS,
    });

    // Opus 5 can decline via safety classifiers; that arrives as a 200 with an
    // empty content array, so check the stop reason before reading content.
    if (message.stop_reason === "refusal") {
      return json({
        reply:
          "That request was declined by the model's safety classifiers. Rephrasing usually clears a false positive.",
        stopReason: message.stop_reason,
      });
    }

    const reply = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return json({
      reply: reply || "No answer was produced. Try asking again.",
      stopReason: message.stop_reason,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    });
  } catch (err) {
    console.error("assistant failed", err);
    if (err instanceof Anthropic.RateLimitError) {
      return fail(429, "rate_limited", "The model is rate limited. Try again shortly.");
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return fail(503, "not_configured", "ANTHROPIC_API_KEY was rejected.");
    }
    return fail(502, "assistant_failed", "The assistant could not answer that.");
  }
}
