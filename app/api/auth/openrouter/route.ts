import { apiError, checkOrigin, database, json, workspaceId } from "@/lib/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const id = workspaceId(request); if (!id) return json({ connected: false });
    const row = await database().prepare("SELECT key_hash, expires_at FROM ai_connections WHERE workspace_id = ? AND expires_at > ?").bind(id, Date.now()).first<{ key_hash: string; expires_at: number }>();
    return json(row ? { connected: true, expiresAt: row.expires_at, manageUrl: `https://openrouter.ai/keys/${row.key_hash}` } : { connected: false });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request); const id = workspaceId(request);
    if (id) await database().batch([database().prepare("DELETE FROM ai_connections WHERE workspace_id = ?").bind(id), database().prepare("DELETE FROM oauth_attempts WHERE workspace_id = ?").bind(id)]);
    return json({ connected: false });
  } catch (error) { return apiError(error); }
}
