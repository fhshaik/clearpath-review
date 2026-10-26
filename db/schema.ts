import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const oauthAttempts = sqliteTable("oauth_attempts", {
  stateHash: text("state_hash").primaryKey(), workspaceId: text("workspace_id").notNull(), verifier: text("verifier").notNull(), origin: text("origin").notNull(), returnPath: text("return_path").notNull(), expiresAt: integer("expires_at").notNull(),
});
export const aiConnections = sqliteTable("ai_connections", {
  workspaceId: text("workspace_id").primaryKey(), encryptedKey: text("encrypted_key").notNull(), keyHash: text("key_hash").notNull(), expiresAt: integer("expires_at").notNull(), lastReviewAt: integer("last_review_at").notNull().default(0),
});
