import { addEvent, currentVersion, DomainError } from "@/lib/domain";
import { connectedKey } from "@/lib/connection";
import { runOpenRouter } from "@/lib/ai";
import { apiError, checkOrigin, json, loadWorkspace, readBody, saveWorkspace, workspaceId } from "@/lib/server";
import { aiRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const id = workspaceId(request);
    if (!id) throw new DomainError("Reload to start your demo session.", 401);
    const parsed = aiRequestSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new DomainError("The analysis request is invalid. Reload and try again.");
    const { revision, campaignId, version: versionNumber, model, role } = parsed.data;
    const envelope = await loadWorkspace(id);
    if (envelope.revision !== revision) throw new DomainError("The workspace changed. Refresh before running AI on the latest version.", 409);
    const campaign = envelope.workspace.campaigns.find(c => c.id === campaignId);
    if (!campaign) throw new DomainError("This campaign could not be found.", 404);
    const version = currentVersion(campaign);
    if (campaign.status !== "in_review" || version.number !== versionNumber) throw new DomainError("Only the current version awaiting review can be analyzed.");
    if (version.analysis.findings.some(f => f.disposition !== "open")) throw new DomainError("This version already has recorded finding decisions. Submit a new version to run a fresh AI review.");
    const key = await connectedKey(id, true);
    version.analysis = await runOpenRouter(key, model, campaign, version.copy);
    addEvent(envelope.workspace, campaign, role, "Live AI review completed", `${model} · ${version.analysis.findings.length} findings · Policy ${"CP-2026.10 v1"}`);
    return json(await saveWorkspace(id, revision, envelope.workspace));
  } catch (error) { return apiError(error); }
}
