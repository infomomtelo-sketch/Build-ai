export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;

  // Public vars (safe to be non-secret; still never needed by the client).
  APP_NAME: string;
  ENVIRONMENT: string;

  // Secrets. These exist only inside the Worker. Nothing in this codebase may
  // return, log, or embed any of these in a response body.
  OWNER_EMAILS?: string;
  SESSION_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  // Local development escape hatch. Off unless explicitly "true", and refused
  // outright when ENVIRONMENT is "production" (see worker/auth.ts).
  ALLOW_DEV_LOGIN?: string;
}
