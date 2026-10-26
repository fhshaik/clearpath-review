import { query } from "../db/client";
import { DomainError } from "./domain";
import { unseal } from "./oauth";

export function connectionSecret() {
  return process.env.AI_CONNECTION_SECRET || "";
}
export async function connectedKey(id: string, claimReview = false) {
  const row = (
    await query<{ encrypted_key: string; expires_at: string }>(
      "SELECT encrypted_key, expires_at FROM ai_connections WHERE workspace_id = $1",
      [id],
    )
  )[0];
  const now = Date.now();
  if (!row || Number(row.expires_at) <= now)
    throw new DomainError("Connect your OpenRouter account to run a live review.", 401);
  const key = await unseal(row.encrypted_key, id, connectionSecret());
  if (claimReview) {
    const claim = await query(
      "UPDATE ai_connections SET last_review_at = $1 WHERE workspace_id = $2 AND last_review_at < $3 RETURNING workspace_id",
      [now, id, now - 60000],
    );
    if (!claim.length)
      throw new DomainError(
        "A review was just started. Wait one minute before running another.",
        429,
      );
  }
  return key;
}
