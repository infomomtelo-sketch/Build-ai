/**
 * Copies headers across, preserving multiple `set-cookie` entries — a plain
 * object spread silently drops everything on a `Headers` instance.
 */
export function mergeHeaders(into: Headers, from?: HeadersInit): Headers {
  if (!from) return into;
  const src = from instanceof Headers ? from : new Headers(from);
  for (const cookie of src.getSetCookie()) into.append("set-cookie", cookie);
  src.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") into.set(key, value);
  });
  return into;
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = mergeHeaders(new Headers(), init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function fail(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, { status });
}

export function redirect(location: string, headers: Headers = new Headers()): Response {
  headers.set("location", location);
  headers.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers });
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export function setCookie(
  headers: Headers,
  name: string,
  value: string,
  opts: { maxAge?: number; secure?: boolean } = {},
): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (opts.secure !== false) parts.push("Secure");
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  headers.append("set-cookie", parts.join("; "));
}

export function clearCookie(headers: Headers, name: string, secure = true): void {
  const parts = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  headers.append("set-cookie", parts.join("; "));
}

/** Opaque per-request client fingerprint source. Hashed before storage. */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

export const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), camera=(), microphone=(self)",
};
