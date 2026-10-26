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
