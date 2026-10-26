import { query } from "../db/client";
import { DomainError, seedWorkspace, type Envelope, type Workspace } from "./domain";

const COOKIE = "clearpath_demo";
export function workspaceId(request: Request): string | null {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
export function json(data: unknown, status = 200, cookieId?: string, request?: Request) {
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  if (cookieId)
    headers["Set-Cookie"] =
      `${COOKIE}=${cookieId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${request && new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  return Response.json(data, { status, headers });
}
export function checkOrigin(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new DomainError("Open ClearPath in its own tab and try this action again.", 403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || ""))
    throw new DomainError("This action requires a JSON request.", 415);
}
export async function readBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 30000)
    throw new DomainError("This submission is too large.", 413);
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 30000) {
          await reader.cancel();
          throw new DomainError("This submission is too large.", 413);
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("The request could not be read. Please try again.");
  }
}
export async function loadWorkspace(id: string): Promise<Envelope> {
  const row = (
    await query<{ data: string; revision: number }>(
      "SELECT data, revision FROM workspaces WHERE id = $1",
      [id],
    )
  )[0];
  if (!row)
    throw new DomainError("Your demo session has expired. Reload to start a new workspace.", 401);
  return { workspace: JSON.parse(row.data) as Workspace, revision: row.revision };
}
export async function ensureWorkspace(
  request: Request,
): Promise<{ id: string; envelope: Envelope; created: boolean }> {
  const existing = workspaceId(request);
  if (existing) {
    try {
      return { id: existing, envelope: await loadWorkspace(existing), created: false };
    } catch (error) {
      if (!(error instanceof DomainError) || error.status !== 401) throw error;
    }
  }
  const id = crypto.randomUUID();
  const workspace = seedWorkspace();
  await query("INSERT INTO workspaces (id, revision, data, updated_at) VALUES ($1, 0, $2, $3)", [
    id,
    JSON.stringify(workspace),
    new Date().toISOString(),
  ]);
  return { id, envelope: { workspace, revision: 0 }, created: true };
}
export async function saveWorkspace(
  id: string,
  revision: number,
  workspace: Workspace,
): Promise<Envelope> {
  const result = await query(
    "UPDATE workspaces SET data = $1, revision = revision + 1, updated_at = $2 WHERE id = $3 AND revision = $4 RETURNING revision",
    [JSON.stringify(workspace), new Date().toISOString(), id, revision],
  );
  if (!result.length)
    throw new DomainError(
      "This workspace changed in another tab. Your latest data has been refreshed; please review it before trying again.",
      409,
    );
  return { workspace, revision: revision + 1 };
}
export function apiError(error: unknown) {
  if (error instanceof DomainError) return json({ error: error.message }, error.status);
  // Never log request bodies, headers, provider responses, or visitor API keys.
  return json(
    {
      error: "This action could not be completed. Your saved work is unchanged. Please try again.",
    },
    500,
  );
}
