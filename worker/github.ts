import { fail, json } from "./http";
import type { Env } from "./env";

export async function getGitHubToken(
  env: Env,
  userId: string,
): Promise<string | null> {
  try {
    const db = env.DB;
    const result = await db
      .prepare("SELECT github_token_encrypted FROM integrations WHERE user_id = ?")
      .bind(userId)
      .first<{ github_token_encrypted: string | null }>();

    if (!result || !result.github_token_encrypted) return null;
    if (!env.SESSION_SECRET) return null;

    // Decrypt the token using a simple XOR with the SESSION_SECRET
    // (In production, use proper encryption like libsodium via wasm)
    return decryptToken(result.github_token_encrypted, env.SESSION_SECRET);
  } catch (err) {
    console.error("Failed to retrieve GitHub token:", err);
    return null;
  }
}

export async function storeGitHubToken(
  env: Env,
  userId: string,
  token: string,
  login: string,
  userId_gh: number,
  avatarUrl: string,
): Promise<void> {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is not configured.");
  const encrypted = encryptToken(token, env.SESSION_SECRET);
  const db = env.DB;

  await db
    .prepare(
      `INSERT OR REPLACE INTO integrations
       (user_id, github_token_encrypted, github_login, github_user_id, github_avatar_url, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
    .bind(userId, encrypted, login, userId_gh, avatarUrl)
    .run();
}

function encryptToken(token: string, key: string): string {
  // Simple XOR encryption (NOT for production)
  // In real use, implement proper encryption with a cryptography library
  const keyRepeated = key.repeat(Math.ceil(token.length / key.length));
  let result = "";
  for (let i = 0; i < token.length; i++) {
    result += String.fromCharCode(token.charCodeAt(i) ^ keyRepeated.charCodeAt(i));
  }
  return btoa(result);
}

function decryptToken(encrypted: string, key: string): string {
  try {
    const decoded = atob(encrypted);
    const keyRepeated = key.repeat(Math.ceil(decoded.length / key.length));
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ keyRepeated.charCodeAt(i));
    }
    return result;
  } catch {
    return "";
  }
}

interface GitHubApiOptions {
  method?: string;
  body?: any;
}

async function callGitHub(
  token: string,
  endpoint: string,
  options: GitHubApiOptions = {},
): Promise<any> {
  const url = `https://api.github.com${endpoint}`;
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "User-Agent": "JARVIS-build-command",
  };

  const fetchOptions: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function handleListRepos(env: Env, userId: string): Promise<Response> {
  const token = await getGitHubToken(env, userId);
  if (!token) {
    return fail(404, "no_integration", "GitHub not integrated for this user.");
  }

  try {
    const data = await callGitHub(token, "/user/repos?per_page=100&sort=updated");
    const repos = (Array.isArray(data) ? data : [])
      .map((r: any) => r.full_name)
      .filter((name: any) => typeof name === "string");

    return json({ repos });
  } catch (err) {
    console.error("Failed to list repos:", err);
    return fail(500, "github_error", `Failed to list repositories: ${String(err)}`);
  }
}

export async function handleGetRepoTree(
  env: Env,
  userId: string,
  repo: string,
  path?: string,
): Promise<Response> {
  const token = await getGitHubToken(env, userId);
  if (!token) {
    return fail(404, "no_integration", "GitHub not integrated for this user.");
  }

  try {
    const endpoint = `/repos/${repo}/contents${path ? `/${path}` : ""}`;
    const data = await callGitHub(token, endpoint);

    if (!Array.isArray(data)) {
      return json({ tree: [] });
    }

    const tree = data.map((item: any) => ({
      name: item.name,
      type: item.type,
      sha: item.sha,
      path: item.path,
      size: item.size,
      url: item.html_url,
    }));

    return json({ tree });
  } catch (err) {
    console.error("Failed to get tree:", err);
    return fail(500, "github_error", `Failed to load tree: ${String(err)}`);
  }
}

export async function handleGetRepoFile(
  env: Env,
  userId: string,
  repo: string,
  path: string,
): Promise<Response> {
  const token = await getGitHubToken(env, userId);
  if (!token) {
    return fail(404, "no_integration", "GitHub not integrated for this user.");
  }

  try {
    const endpoint = `/repos/${repo}/contents/${path}`;
    const data = await callGitHub(token, endpoint);

    if (data.type !== "file") {
      return fail(400, "not_a_file", "Path does not point to a file.");
    }

    // GitHub returns content base64-encoded
    const content = atob(data.content);

    return json({
      file: {
        name: data.name,
        path: data.path,
        sha: data.sha,
        size: data.size,
        type: data.type,
        content,
      },
    });
  } catch (err) {
    console.error("Failed to get file:", err);
    return fail(500, "github_error", `Failed to load file: ${String(err)}`);
  }
}

export async function handleGetRepoCommits(
  env: Env,
  userId: string,
  repo: string,
): Promise<Response> {
  const token = await getGitHubToken(env, userId);
  if (!token) {
    return fail(404, "no_integration", "GitHub not integrated for this user.");
  }

  try {
    const endpoint = `/repos/${repo}/commits?per_page=20`;
    const data = await callGitHub(token, endpoint);

    if (!Array.isArray(data)) {
      return json({ commits: [] });
    }

    const commits = data.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name ?? "Unknown",
      date: c.commit.author?.date ?? "",
      url: c.html_url,
    }));

    return json({ commits });
  } catch (err) {
    console.error("Failed to get commits:", err);
    return fail(500, "github_error", `Failed to load commits: ${String(err)}`);
  }
}
