-- JARVIS — Phase 1: auth foundation
--
-- Security model note (D1 / SQLite vs Postgres):
--   The spec calls for RLS + a has_role() SECURITY DEFINER function. SQLite/D1
--   has neither row-level security nor stored functions. The equivalent
--   guarantee here is stronger in one respect and weaker in none that matters:
--   the browser has NO database credential at all and cannot issue SQL. Every
--   read and write goes through the Worker, and every authorization decision
--   funnels through the single has_role() chokepoint in worker/roles.ts.
--   The structural requirements that DO carry over are honored exactly:
--     - roles live in their own table, never as a column on profiles
--     - role checks are a function call, never an inline string comparison
--     - the owner allowlist is server-side only, never shipped to the client

-- ── profiles ────────────────────────────────────────────────────────────────
-- Identity only. Deliberately has no `role` column.
CREATE TABLE profiles (
  id            TEXT PRIMARY KEY,             -- internal uuid
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  github_login  TEXT,
  github_id     INTEGER UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT
);

CREATE INDEX idx_profiles_email ON profiles (email);

-- ── user_roles ──────────────────────────────────────────────────────────────
-- Separate table, one row per (user, role). Read only via has_role().
CREATE TABLE user_roles (
  user_id     TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'operator', 'viewer')),
  granted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, role)
);

CREATE INDEX idx_user_roles_user ON user_roles (user_id);

-- ── sessions ────────────────────────────────────────────────────────────────
-- Server-side session records. The cookie carries only an opaque, HMAC-signed
-- session id; revoking a session means deleting the row here.
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,               -- opaque random id
  user_id     TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  user_agent  TEXT,
  ip_hash     TEXT                            -- hashed, never the raw address
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- ── auth_events ─────────────────────────────────────────────────────────────
-- Append-only audit trail of every authentication decision, including denials.
CREATE TABLE auth_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (datetime('now')),
  event       TEXT NOT NULL,                  -- login_ok | login_denied | logout | ...
  email       TEXT,
  detail      TEXT,
  ip_hash     TEXT
);

CREATE INDEX idx_auth_events_at ON auth_events (at);

-- ── rate_limits ─────────────────────────────────────────────────────────────
-- Fixed-window counters. Phase 1 protects the auth endpoints; later phases
-- reuse this for AI and deploy actions.
CREATE TABLE rate_limits (
  bucket        TEXT PRIMARY KEY,             -- "<scope>:<key>:<window>"
  count         INTEGER NOT NULL DEFAULT 0,
  window_start  INTEGER NOT NULL              -- unix seconds
);

CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);
