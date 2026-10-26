import { apiError, checkOrigin, database, json, loadWorkspace, readBody, workspaceId } from "@/lib/server";
import { authorizationUrl, hash, randomToken } from "@/lib/oauth";
import { connectionSecret } from "@/lib/connection";
import { DomainError } from "@/lib/domain";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!/^[a-f0-9]{64}$/.test(connectionSecret())) throw new DomainError("AI connection is temporarily unavailable. Continue with the sample workflow.", 503);
    const id = workspaceId(request); if (!id) throw new DomainError("Reload to start your demo session.", 401);
    await loadWorkspace(id);
    const body = await readBody(request) as { campaignId?: unknown };
    const campaign = typeof body.campaignId === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(body.campaignId) ? body.campaignId : "";
    const returnPath = campaign ? `/?campaign=${encodeURIComponent(campaign)}` : "/";
    const state = randomToken(), verifier = randomToken(), origin = new URL(request.url).origin;
    await database().batch([
      database().prepare("DELETE FROM oauth_attempts WHERE expires_at < ? OR workspace_id = ?").bind(Date.now(), id),
      database().prepare("INSERT INTO oauth_attempts (state_hash, workspace_id, verifier, origin, return_path, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(await hash(state), id, verifier, origin, returnPath, Date.now() + 600000),
    ]);
    return json({ url: await authorizationUrl(origin, state, verifier) });
  } catch (error) { return apiError(error); }
}
