import { DomainError } from "./domain";

const encoder = new TextEncoder();
export function randomToken() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function authorizationUrl(origin: string, state: string, verifier: string) {
  const url = new URL("https://openrouter.ai/auth");
  url.search = new URLSearchParams({
    callback_url: `${origin}/api/auth/openrouter/callback`,
    code_challenge: encode(
      new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))),
    ),
    code_challenge_method: "S256",
    state,
    key_label: "ClearPath Review demo",
  }).toString();
  return url.toString();
}
async function encryptionKey(secret: string) {
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new DomainError(
      "AI connection is temporarily unavailable. Continue with the sample workflow.",
      503,
    );
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secret.match(/../g)!, (n) => parseInt(n, 16)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(key: string, workspace: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(workspace) },
    await encryptionKey(secret),
    encoder.encode(key),
  );
  return `${encode(iv)}.${encode(new Uint8Array(cipher))}`;
}
export async function unseal(value: string, workspace: string, secret: string) {
  try {
    const [iv, cipher] = value.split(".");
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decode(iv), additionalData: encoder.encode(workspace) },
        await encryptionKey(secret),
        decode(cipher),
      ),
    );
  } catch {
    throw new DomainError(
      "Your AI connection has expired. Reconnect OpenRouter to run a live review.",
      401,
    );
  }
}
export async function exchangeCode(
  code: string,
  verifier: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetcher("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new DomainError("OpenRouter did not complete the connection. Please reconnect.", 504);
  }
  if (!response.ok)
    throw new DomainError(
      "OpenRouter could not complete sign-in. Please reconnect and approve a fresh request.",
      401,
    );
  let data: { key?: unknown };
  try {
    data = await response.json();
  } catch {
    throw new DomainError("OpenRouter returned an unreadable connection. Please reconnect.", 502);
  }
  if (typeof data.key !== "string" || !/^sk-or-v1-[A-Za-z0-9_-]{20,400}$/.test(data.key))
    throw new DomainError("OpenRouter returned an invalid connection. Please reconnect.", 502);
  return data.key;
}
