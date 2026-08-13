import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { fail, json } from "./http";
import type { Env } from "./env";
import type { Viewer } from "./session";
import {
  queryMetrics,
  recentActivity,
  readRepoFile,
  searchRepo,
  summarizeErrors,
} from "./assistant";

/**
 * Phase 7 — daily briefing.
 *
 * One GET request runs a purpose-built prompt through the same tool set as the
 * assistant, then parses the model's structured response into five sections.
 * The endpoint is stateless and idempotent — re-requesting on the same day
 * just re-runs the model against the current data.
 */

const MODEL = "claude-opus-5";
const EFFORT = "medium" as const;
const MAX_ITERATIONS = 10;

const BRIEFING_SYSTEM = `You are JARVIS, running the daily briefing for a single-operator
build command center. The operator owns every project you can see.

Use the available tools to read current data: project metrics, error groups, and
the recent event log. Then write the briefing as a JSON object — no markdown, no
code fences, raw JSON only — with these five string keys:

  status   — one sentence: overall system health right now
  metrics  — 2–3 sentences: revenue, users, notable trends, or "no metrics recorded yet"
  errors   — 2–3 sentences: open error groups worth acting on, or "no open errors"
  shipped  — 1–2 sentences: recent deploys or registry changes from the event log
  action   — the top 2–3 things the operator should do today, each on its own line
             starting with a bullet (•)

Ground every fact in tool output. Do not invent figures. Be terse — this is
read on a HUD, not in a report.`;

export interface BriefingSections {
  status: string;
  metrics: string;
  errors: string;
  shipped: string;
  action: string;
}

export interface BriefingData {
  generatedAt: string;
  sections: BriefingSections;
}

export async function handleBriefing(env: Env, viewer: Viewer): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return fail(
      503,
      "not_configured",
      "The briefing needs ANTHROPIC_API_KEY set as a Worker secret.",
    );
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const tools = [
    betaTool({
      name: "query_metrics",
      description:
        "Read all registered projects with their latest metrics and health. Call with no argument to get every project.",
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
        "Read unresolved error groups ranked by user impact. Call with no argument to sweep every project.",
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
        "Read the console event log — registry changes, recorded metrics, and other activity, newest first.",
      inputSchema: { type: "object", properties: {} },
      run: () => recentActivity(env),
    }),
    betaTool({
      name: "read_file",
      description: "Read one file from a GitHub repository the operator owns.",
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
      description: "Search code inside one GitHub repository and return matching file paths.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full name, e.g. owner/repo." },
          query: { type: "string", description: "Text to search for." },
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
      max_tokens: 4096,
      system: BRIEFING_SYSTEM,
      output_config: { effort: EFFORT },
      tools,
      messages: [
        {
          role: "user",
          content:
            "Generate my daily briefing now. Read metrics, errors, and recent activity first.",
        },
      ],
      max_iterations: MAX_ITERATIONS,
    });

    const rawText = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let sections: BriefingSections;
    try {
      // Strip accidental code fences, then extract the outermost JSON object.
      const stripped = rawText.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "");
      const first = stripped.indexOf("{");
      const last = stripped.lastIndexOf("}");
      const jsonSlice = first !== -1 && last > first ? stripped.slice(first, last + 1) : stripped;
      sections = JSON.parse(jsonSlice) as BriefingSections;
    } catch {
      // Model didn't follow the JSON instruction — surface what it said in the
      // status field so the operator still gets something useful.
      sections = {
        status: rawText || "Briefing could not be structured — see raw output.",
        metrics: "",
        errors: "",
        shipped: "",
        action: "",
      };
    }

    const data: BriefingData = {
      generatedAt: new Date().toISOString(),
      sections,
    };

    return json(data);
  } catch (err) {
    console.error("briefing failed", err);
    if (err instanceof Anthropic.RateLimitError) {
      return fail(429, "rate_limited", "The model is rate limited. Try again shortly.");
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return fail(503, "not_configured", "ANTHROPIC_API_KEY was rejected.");
    }
    return fail(502, "briefing_failed", "Could not generate the daily briefing.");
  }
}
