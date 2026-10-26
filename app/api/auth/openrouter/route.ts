import { apiError, checkOrigin, json, workspaceId } from "@/lib/server";
import { query, transaction } from "@/db/client";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const id = workspaceId(request);
    if (!id) return json({ connected: false });
    const row = (
      await query<{ key_hash: string; expires_at: string }>(
        "SELECT key_hash, expires_at FROM ai_connections WHERE workspace_id = $1 AND expires_at > $2",
        [id, Date.now()],
      )
    )[0];
    return json(
      row
        ? {
            connected: true,
            expiresAt: Number(row.expires_at),
            manageUrl: "https://openrouter.ai/keys",
          }
        : { connected: false },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const id = workspaceId(request);
    if (id)
      await transaction([
        { text: "DELETE FROM ai_connections WHERE workspace_id = $1", values: [id] },
        { text: "DELETE FROM oauth_attempts WHERE workspace_id = $1", values: [id] },
      ]);
    return json({ connected: false });
  } catch (error) {
    return apiError(error);
  }
}
