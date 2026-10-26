import { workspaceId } from "@/lib/server";
import { query } from "@/db/client";
import { connectionSecret } from "@/lib/connection";
import { exchangeCode, hash, seal } from "@/lib/oauth";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let returnPath = "/";
  const redirect = (status: string) => {
    const target = new URL(returnPath, request.url); target.searchParams.set("ai_connection", status);
    return new Response(null, { status: 303, headers: { Location: target.pathname + target.search, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  };
  try {
    const url = new URL(request.url), id = workspaceId(request), state = url.searchParams.get("state"), code = url.searchParams.get("code");
    if (url.searchParams.has("error")) return redirect("cancelled");
    if (!id || !state || !/^[A-Za-z0-9_-]{43}$/.test(state) || !code || code.length > 2000) return redirect("failed");
    // Atomically consume this browser-bound attempt before exchanging any code.
    const attempt = (await query<{verifier:string; return_path:string}>("DELETE FROM oauth_attempts WHERE state_hash = $1 AND workspace_id = $2 AND expires_at > $3 AND origin = $4 RETURNING verifier, return_path", [await hash(state), id, Date.now(), url.origin]))[0];
    if (!attempt) return redirect("failed");
    returnPath = attempt.return_path;
    const key = await exchangeCode(code, attempt.verifier);
    await query("INSERT INTO ai_connections (workspace_id, encrypted_key, key_hash, expires_at, last_review_at) VALUES ($1, $2, $3, $4, 0) ON CONFLICT(workspace_id) DO UPDATE SET encrypted_key = excluded.encrypted_key, key_hash = excluded.key_hash, expires_at = excluded.expires_at, last_review_at = 0", [id, await seal(key, id, connectionSecret()), await hash(key), Date.now() + 86400000]);
    return redirect("connected");
  } catch { return redirect("failed"); }
}
