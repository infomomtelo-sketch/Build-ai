-- Phase 3: GitHub integration
-- Stores encrypted access tokens for reading repositories, commits, and files.

CREATE TABLE IF NOT EXISTS integrations (
  user_id TEXT NOT NULL PRIMARY KEY,
  github_token_encrypted TEXT,
  github_login TEXT,
  github_avatar_url TEXT,
  github_user_id INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
