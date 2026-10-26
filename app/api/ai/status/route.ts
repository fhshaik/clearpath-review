import { apiError, json, workspaceId } from "@/lib/server";
import { sponsoredStatus } from "@/lib/sponsored";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return json(await sponsoredStatus(workspaceId(request)));
  } catch (error) {
    return apiError(error);
  }
}
