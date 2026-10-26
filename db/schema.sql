CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_attempts (
  state_hash TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  verifier TEXT NOT NULL,
  origin TEXT NOT NULL,
  return_path TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_attempts_workspace_idx ON oauth_attempts(workspace_id);
CREATE INDEX IF NOT EXISTS oauth_attempts_expiry_idx ON oauth_attempts(expires_at);

CREATE TABLE IF NOT EXISTS ai_connections (
  workspace_id TEXT PRIMARY KEY,
  encrypted_key TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  last_review_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sponsored_budget (
  id TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0)
);
INSERT INTO sponsored_budget (id, used) VALUES ('demo-v1', 0) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS sponsored_sessions (
  workspace_id TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  last_started_at BIGINT NOT NULL DEFAULT 0
);
