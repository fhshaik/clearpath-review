import test from "node:test";
import assert from "node:assert/strict";
import { authorizationUrl, exchangeCode, hash, randomToken, seal, unseal } from "../lib/oauth";

const secret = "ab".repeat(32),
  workspace = "demo-workspace",
  token = "sk-or-v1-FAKE_CREDENTIAL_FOR_TESTS_ONLY_123456";
test("OpenRouter authorization uses S256 PKCE, state, and a fixed callback", async () => {
  const verifier = randomToken(),
    state = randomToken();
  assert.equal(verifier.length, 43);
  assert.notEqual(verifier, state);
  const url = new URL(await authorizationUrl("https://demo.example", state, verifier));
  assert.equal(url.origin, "https://openrouter.ai");
  assert.equal(url.pathname, "/auth");
  assert.equal(url.searchParams.get("state"), state);
  assert.equal(
    url.searchParams.get("callback_url"),
    "https://demo.example/api/auth/openrouter/callback",
  );
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    url.searchParams.get("code_challenge"),
    Buffer.from(await hash(verifier), "hex").toString("base64url"),
  );
  assert.ok(!url.toString().includes(verifier));
});
test("credentials are encrypted and bound to their own workspace", async () => {
  const sealed = await seal(token, workspace, secret);
  assert.ok(!sealed.includes(token));
  assert.notEqual(sealed, await seal(token, workspace, secret));
  assert.equal(await unseal(sealed, workspace, secret), token);
  await assert.rejects(unseal(sealed, "different-workspace", secret), /expired/);
  await assert.rejects(unseal(sealed, workspace, "cd".repeat(32)), /expired/);
  await assert.rejects(unseal(sealed.slice(0, -10), workspace, secret), /expired/);
  await assert.rejects(seal(token, workspace, ""), /temporarily unavailable/);
});
test("OAuth code exchange is server-side, fixed-origin, and does not follow redirects", async () => {
  const verifier = randomToken();
  const key = await exchangeCode("test-code", verifier, (async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/v1/auth/keys");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(init?.body as string), {
      code: "test-code",
      code_verifier: verifier,
      code_challenge_method: "S256",
    });
    return Response.json({ key: token });
  }) as typeof fetch);
  assert.equal(key, token);
});
test("rejected or malformed exchanges cannot become an AI connection", async () => {
  await assert.rejects(
    exchangeCode(
      "bad-code",
      "verifier",
      (async () => new Response(token, { status: 403 })) as typeof fetch,
    ),
    (error) => error instanceof Error && !error.message.includes(token),
  );
  await assert.rejects(
    exchangeCode("code", "verifier", (async () => Response.json({ key: "wrong" })) as typeof fetch),
    /invalid connection/,
  );
  await assert.rejects(
    exchangeCode("code", "verifier", (async () => new Response("not json")) as typeof fetch),
    /unreadable connection/,
  );
});
