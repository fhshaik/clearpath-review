import { applyAction, DomainError } from "@/lib/domain";
import {
  apiError,
  checkOrigin,
  ensureWorkspace,
  json,
  loadWorkspace,
  readBody,
  saveWorkspace,
  workspaceId,
} from "@/lib/server";
import { mutationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { id, envelope, created } = await ensureWorkspace(request);
    return json(envelope, 200, created ? id : undefined, request);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const id = workspaceId(request);
    if (!id) throw new DomainError("Reload to start your demo session.", 401);
    const parsed = mutationSchema.safeParse(await readBody(request));
    if (!parsed.success)
      throw new DomainError(parsed.error.issues[0]?.message || "Check the submission details.");
    const { revision, action } = parsed.data;
    if (action.type === "submit" && action.channel === "Affiliate" && !action.partner.trim())
      throw new DomainError("Add the affiliate partner's name.");
    const envelope = await loadWorkspace(id);
    if (envelope.revision !== revision)
      throw new DomainError(
        "This workspace changed in another tab. Refresh and review the latest version.",
        409,
      );
    if (action.type === "submit" && envelope.workspace.campaigns.length >= 50)
      throw new DomainError(
        "This demo supports 50 campaigns. Export your records and reset the demo to continue.",
      );
    return json(await saveWorkspace(id, revision, applyAction(envelope.workspace, action)));
  } catch (error) {
    return apiError(error);
  }
}
