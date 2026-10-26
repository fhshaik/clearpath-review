import test from "node:test";
import assert from "node:assert/strict";
import { policyChecks } from "../lib/domain";
import { csvCell, wordDiff } from "../lib/presentation";
import { mutationSchema, aiRequestSchema } from "../lib/validation";
import { checkOrigin, json, readBody, workspaceId } from "../lib/server";

for (const phrase of [
  "No guaranteed approval.",
  "This is not a guaranteed approval.",
  "Never guaranteed approval.",
])
  test(`qualified claim stays qualified: ${phrase}`, () =>
    assert.ok(!policyChecks(phrase, "Personal loan", "Email").some((f) => f.policyId === "CP-01")));
test("a negated claim cannot hide a subsequent approval guarantee", () => {
  const findings = policyChecks(
    "No guaranteed approval? Everyone is approved.",
    "Personal loan",
    "Email",
  );
  assert.equal(findings.find((f) => f.policyId === "CP-01")?.quote, "Everyone is approved");
});
for (const copy of [
  "Receive your loan after underwriting.",
  "Earn rewards with your eligible purchase.",
  "Your loan can be paid in full early.",
])
  test(`ordinary ad language is not affiliate disclosure: ${copy}`, () =>
    assert.ok(
      policyChecks(copy, "Personal loan", "Affiliate").some((f) => f.policyId === "CP-04"),
    ));
for (const copy of [
  "We may receive compensation if you apply through this link.",
  "We earn a commission on applications.",
  "Sponsored by ClearPath.",
  "This is a paid partnership.",
])
  test(`recognized affiliate relationship: ${copy}`, () =>
    assert.ok(
      !policyChecks(copy, "Personal loan", "Affiliate").some((f) => f.policyId === "CP-04"),
    ));
for (const [before, after] of [
  ["\n\n", ""],
  ["", "  "],
  [" \t ", "\n"],
  [" Leading whitespace\n", " Leading changed whitespace\n"],
  ["é — loan\n\n中文", "é — terms\n\n中文"],
])
  test(`diff preserves exact texts ${JSON.stringify(before)}`, () => {
    const pieces = wordDiff(before, after);
    assert.equal(
      pieces
        .filter((p) => p.kind !== "add")
        .map((p) => p.text)
        .join(""),
      before,
    );
    assert.equal(
      pieces
        .filter((p) => p.kind !== "remove")
        .map((p) => p.text)
        .join(""),
      after,
    );
  });
test("large diffs use a bounded fallback without losing source", () => {
  const before = "word ".repeat(1600),
    after = "term ".repeat(1600);
  const pieces = wordDiff(before, after);
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0].text, before);
  assert.equal(pieces[1].text, after);
});
for (const value of ["=1+1", "\t=CMD()", "\r@SUM(A1)", " -2+3", "+SUM(2,3)"])
  test(`CSV neutralizes formula prefix ${JSON.stringify(value)}`, () =>
    assert.ok(csvCell(value).startsWith("\"'")));
test("input validation rejects blank, oversized, and forged workflow values", () => {
  const action = {
    type: "submit",
    role: "marketer",
    name: "A campaign",
    product: "Personal loan",
    channel: "Website",
    partner: "ClearPath",
    dueAt: new Date().toISOString(),
    copy: "A sufficiently long fictional ad.",
  };
  assert.ok(mutationSchema.safeParse({ revision: 0, action }).success);
  for (const overrides of [
    { copy: " ".repeat(25) },
    { copy: "x".repeat(6001) },
    { product: "Cryptocurrency" },
    { role: "admin" },
    { dueAt: "tomorrow" },
  ])
    assert.ok(
      !mutationSchema.safeParse({ revision: 0, action: { ...action, ...overrides } }).success,
    );
  assert.ok(!mutationSchema.safeParse({ revision: -1, action }).success);
});
test("AI requests allow only known provider and model identifiers", () => {
  const body = {
    revision: 0,
    campaignId: "cp-1048",
    version: 1,
    provider: "sponsored",
    model: "claude-haiku-5-5",
  };
  assert.ok(aiRequestSchema.safeParse(body).success);
  assert.ok(!aiRequestSchema.safeParse({ ...body, provider: "https://attacker.example" }).success);
  assert.ok(!aiRequestSchema.safeParse({ ...body, model: "arbitrary-expensive-model" }).success);
});
test("HTTP session parser accepts only a v4 UUID and ignores forged cookies", () => {
  assert.equal(
    workspaceId(
      new Request("https://example.test", {
        headers: { cookie: "clearpath_demo=not-a-workspace" },
      }),
    ),
    null,
  );
  const id = crypto.randomUUID();
  assert.equal(
    workspaceId(
      new Request("https://example.test", {
        headers: { cookie: `other=yes; clearpath_demo=${id}; last=no` },
      }),
    ),
    id,
  );
});
test("writes require same origin, JSON content, and non-cross-site context", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://example.test/api/workspace", { method: "POST", headers });
  const valid = { Origin: "https://example.test", "Content-Type": "application/json" };
  assert.doesNotThrow(() => checkOrigin(request(valid)));
  for (const headers of [
    { ...valid, Origin: "https://attacker.test" },
    { ...valid, "Sec-Fetch-Site": "cross-site" },
    { "Content-Type": "application/json" },
    { Origin: "https://example.test", "Content-Type": "text/plain" },
  ])
    assert.throws(() => checkOrigin(request(headers)));
});
test("body limits count UTF-8 bytes even without content-length", async () => {
  await assert.rejects(
    readBody(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ copy: "💚".repeat(8000) }),
      }),
    ),
    /too large/,
  );
  await assert.rejects(
    readBody(new Request("https://example.test", { method: "POST", body: "{broken" })),
    /could not be read/,
  );
  assert.deepEqual(
    await readBody(new Request("https://example.test", { method: "POST", body: '{"ok":true}' })),
    { ok: true },
  );
});
test("API responses protect cookies and are never cached publicly", () => {
  const response = json(
    { ok: true },
    200,
    crypto.randomUUID(),
    new Request("https://example.test"),
  );
  assert.match(response.headers.get("set-cookie") || "", /HttpOnly; SameSite=Lax/);
  assert.match(response.headers.get("set-cookie") || "", /Secure/);
  assert.match(response.headers.get("cache-control") || "", /private, no-store/);
  assert.equal(response.headers.get("vary"), "Cookie");
});
test("JSON-like content types do not bypass the JSON requirement", () =>
  assert.throws(
    () =>
      checkOrigin(
        new Request("https://example.test", {
          method: "POST",
          headers: { Origin: "https://example.test", "Content-Type": "application/jsonp" },
        }),
      ),
    /JSON request/,
  ));
test("body streaming preserves split multibyte text and stops oversized streams", async () => {
  const data = new TextEncoder().encode('{"copy":"💚"}');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data.slice(0, 11));
      controller.enqueue(data.slice(11));
      controller.close();
    },
  });
  assert.deepEqual(
    await readBody(
      new Request("https://example.test", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
    ),
    { copy: "💚" },
  );
  let cancelled = false;
  const oversized = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(30001));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readBody(
      new Request("https://example.test", {
        method: "POST",
        body: oversized,
        duplex: "half",
      } as RequestInit),
    ),
    /too large/,
  );
  assert.ok(cancelled);
});
