-- JARVIS — Phase 2: project registry + manual metrics
--
-- The wall becomes real here. Everything on it is owner-entered until the
-- integrations of phases 3–4 start writing to these same tables — the shapes
-- are chosen so those integrations fill them rather than replace them.

-- ── projects ────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  domain        TEXT,
  stack         TEXT,
  repo_full_name TEXT,                      -- "owner/repo", linked in phase 3
  -- Owner-declared until phase 4 computes it from error rate and uptime.
  health        TEXT NOT NULL DEFAULT 'nominal'
                  CHECK (health IN ('nominal', 'warn', 'critical', 'idle')),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'archived')),
  notes         TEXT,
  last_deploy_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_health ON projects (health);

-- ── metrics_daily ───────────────────────────────────────────────────────────
-- One row per project per day. Manually entered in phase 2; Stripe and the
-- error pipeline upsert the same rows from phase 4 on, which is why `source`
-- exists — so a later automatic value can be told apart from a typed one.
CREATE TABLE metrics_daily (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  day         TEXT NOT NULL,                -- YYYY-MM-DD, UTC
  mrr_cents   INTEGER NOT NULL DEFAULT 0,   -- integer cents, never floats
  users       INTEGER NOT NULL DEFAULT 0,
  signups     INTEGER NOT NULL DEFAULT 0,
  deploys     INTEGER NOT NULL DEFAULT 0,
  errors      INTEGER NOT NULL DEFAULT 0,
  uptime_pct  REAL,                         -- 0–100, null when unknown
  source      TEXT NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'stripe', 'sentry', 'github', 'host')),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, day)
);

CREATE INDEX idx_metrics_project_day ON metrics_daily (project_id, day DESC);
CREATE INDEX idx_metrics_day ON metrics_daily (day DESC);

-- ── events ──────────────────────────────────────────────────────────────────
-- The rolling log on the right rail of the wall. Phase 2 writes registry and
-- metrics events; later phases add deploys, incidents, and AI actions.
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL DEFAULT (datetime('now')),
  project_id  TEXT REFERENCES projects (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                -- project_created | metrics_recorded | ...
  severity    TEXT NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info', 'warn', 'critical')),
  message     TEXT NOT NULL,
  actor       TEXT                          -- profile id, or a system source
);

CREATE INDEX idx_events_at ON events (at DESC);
CREATE INDEX idx_events_project ON events (project_id, at DESC);
