-- Phase 4: Error ingest and fix queue
-- Stores errors grouped by fingerprint, tracks impact and resolution status.

CREATE TABLE IF NOT EXISTS errors (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  context TEXT,
  count INTEGER DEFAULT 1,
  affected_sessions INTEGER DEFAULT 0,
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_errors_fingerprint
  ON errors(project_id, fingerprint);

CREATE INDEX IF NOT EXISTS idx_errors_last_seen
  ON errors(project_id, last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_errors_resolved
  ON errors(resolved_at) WHERE resolved_at IS NULL;

-- Error impact score computed from count + affected_sessions + time-since-last.
-- Recomputed on query, not stored (so it reflects live state).
-- score = (count / total_errors_in_project) * (affected_sessions / avg_sessions) * recency_factor
