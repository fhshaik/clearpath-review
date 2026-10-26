import { query } from "../db/client";
import { DomainError } from "./domain";

export const SPONSORED_SESSION_LIMIT = 2;
export const SPONSORED_GLOBAL_LIMIT = 20;
export const SPONSORED_INTERVAL_MS = 60000;
// Each attempted request reserves $0.05 conservatively; no automatic refunds/retries.
// Twenty attempts reserve at most $1. Actual provider billing depends on token usage.
export function sponsoredEnabled() {
  return process.env.CLEARPATH_SPONSORED_AI === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
}
export async function sponsoredStatus(id: string | null) {
  if (!sponsoredEnabled() || !id) return { available: false, remaining: 0 };
  const row = (
    await query<{ global_used: number; session_used: number; last_started_at: string }>(
      "SELECT b.used AS global_used, COALESCE(s.used, 0) AS session_used, COALESCE(s.last_started_at, 0) AS last_started_at FROM sponsored_budget b LEFT JOIN sponsored_sessions s ON s.workspace_id = $1 WHERE b.id = 'demo-v1'",
      [id],
    )
  )[0];
  if (!row) return { available: false, remaining: 0 };
  const remaining = Math.max(
    0,
    Math.min(SPONSORED_SESSION_LIMIT - row.session_used, SPONSORED_GLOBAL_LIMIT - row.global_used),
  );
  return {
    available: remaining > 0,
    remaining,
    nextAvailableAt: Number(row.last_started_at) + SPONSORED_INTERVAL_MS,
  };
}
export async function claimSponsoredReview(
  id: string,
  options: { budgetId?: string; now?: number } = {},
) {
  if (!sponsoredEnabled())
    throw new DomainError(
      "Included AI is unavailable. Connect OpenRouter or continue with the sample workflow.",
      503,
    );
  const now = options.now ?? Date.now();
  // Both counters are claimed atomically in one statement. Concurrent requests
  // cannot overspend the global cap or exceed this workspace's allowance.
  const claims = await query<{ used: number }>(
    `WITH session_claim AS (
      INSERT INTO sponsored_sessions (workspace_id, used, last_started_at) VALUES ($1, 1, $2)
      ON CONFLICT (workspace_id) DO UPDATE SET used = sponsored_sessions.used + 1, last_started_at = excluded.last_started_at
      WHERE sponsored_sessions.used < $3 AND sponsored_sessions.last_started_at <= $4 RETURNING workspace_id
    ) UPDATE sponsored_budget SET used = used + 1
      WHERE id = $6 AND used < $5 AND EXISTS (SELECT 1 FROM session_claim) RETURNING used`,
    [
      id,
      now,
      SPONSORED_SESSION_LIMIT,
      now - SPONSORED_INTERVAL_MS,
      SPONSORED_GLOBAL_LIMIT,
      options.budgetId ?? "demo-v1",
    ],
  );
  if (!claims.length)
    throw new DomainError(
      "Included review allowance reached, or a review just started. Wait one minute or connect your own OpenRouter account. The sample workflow remains available.",
      429,
    );
}
