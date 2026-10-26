import { env } from "cloudflare:workers";
import { DomainError } from "./domain";
import { database } from "./server";
import { unseal } from "./oauth";

export function connectionSecret() { return (env as unknown as Record<string, string>).AI_CONNECTION_SECRET || ""; }
export async function connectedKey(id: string, claimReview = false) {
  const row = await database().prepare("SELECT encrypted_key, expires_at FROM ai_connections WHERE workspace_id = ?").bind(id).first<{ encrypted_key: string; expires_at: number }>();
  const now = Date.now();
  if (!row || row.expires_at <= now) throw new DomainError("Connect your OpenRouter account to run a live review.", 401);
  const key = await unseal(row.encrypted_key, id, connectionSecret());
  if (claimReview) {
    const claim = await database().prepare("UPDATE ai_connections SET last_review_at = ? WHERE workspace_id = ? AND last_review_at < ?").bind(now, id, now - 60000).run();
    if (!claim.meta.changes) throw new DomainError("A review was just started. Wait one minute before running another.", 429);
  }
  return key;
}
