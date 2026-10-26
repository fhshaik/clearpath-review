import test from "node:test";
import assert from "node:assert/strict";
import { runOpenRouter, validateAnalysis } from "../lib/ai";
import { currentVersion, seedWorkspace } from "../lib/domain";

const campaign = seedWorkspace().campaigns[0];
const copy = currentVersion(campaign).copy;
const good = {
  summary: "The approval guarantee needs qualification and substantiation.",
  findings: [
    {
      policyId: "CP-01",
      severity: "high",
      title: "Unqualified approval claim",
      quote: "Guaranteed approval",
      explanation: "This is an unconditional claim about an underwriting outcome.",
      suggestion: "Replace it with qualified eligibility language.",
    },
  ],
  proposedCopy: "Explore your options. Approval is subject to eligibility and underwriting.",
};
const fakeKey = "sk-or-v1-NOT_A_REAL_KEY_FOR_TESTING_ONLY_123456";

test("AI evidence must be an exact substring of the submitted creative", () => {
  const bad = structuredClone(good);
  bad.findings[0].quote = "An invented claim absent from this creative";
  assert.throws(() => validateAnalysis(bad, campaign, copy, "test-model"), /could not be verified/);
});
test("AI cannot cite unknown or inapplicable policy IDs", () => {
  const unknown = structuredClone(good);
  unknown.findings[0].policyId = "FAKE-42";
  assert.throws(() => validateAnalysis(unknown, campaign, copy, "test-model"), /incomplete review/);
  const wrongProduct = structuredClone(good);
  wrongProduct.findings[0].policyId = "CP-03";
  assert.throws(
    () => validateAnalysis(wrongProduct, campaign, copy, "test-model"),
    /could not be verified/,
  );
});
test("AI rewrites introducing new numerical terms are withheld", () => {
  const raw = structuredClone(good);
  raw.proposedCopy = "Explore loans at 4.75% APR for 72 months.";
  const result = validateAnalysis(raw, campaign, copy, "test-model");
  assert.equal(result.proposedCopy, "");
  assert.equal(result.warnings.length, 1);
});
test("a live result retains deterministic policies omitted by the model", () => {
  const result = validateAnalysis(good, campaign, copy, "test-model");
  assert.equal(result.mode, "live");
  assert.ok(result.findings.some((f) => f.policyId === "CP-01" && f.origin === "ai"));
  assert.ok(result.findings.some((f) => f.policyId === "CP-02" && f.origin === "policy"));
  assert.ok(result.findings.some((f) => f.policyId === "CP-04" && f.origin === "policy"));
});
test("an unrelated AI finding cannot erase a deterministic concern under the same policy", () => {
  const raw = structuredClone(good);
  raw.findings[0].quote = "Check your rate in minutes.";
  const result = validateAnalysis(raw, campaign, copy, "test-model");
  assert.ok(
    result.findings.some((f) => f.origin === "policy" && f.quote === "Guaranteed approval"),
  );
});
test("AI keys go only in a header to a fixed OpenRouter endpoint; creative is data", async () => {
  let calls = 0;
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.ok(!String(url).includes(fakeKey));
    assert.equal((init?.headers as Record<string, string>)["Authorization"], `Bearer ${fakeKey}`);
    const body = JSON.parse(init?.body as string);
    assert.ok(!JSON.stringify(body).includes(fakeKey));
    assert.equal(JSON.parse(body.messages[1].content).creative, copy);
    assert.match(body.messages[0].content, /untrusted advertising data/);
    assert.equal(body.tools, undefined);
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.provider.require_parameters, true);
    assert.equal(init?.redirect, "error");
    return Response.json({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(good) } }],
    });
  }) as typeof fetch;
  const result = await runOpenRouter(fakeKey, "openai/gpt-4.1-mini", campaign, copy, fetcher);
  assert.equal(calls, 1);
  assert.equal(result.mode, "live");
  assert.ok(!JSON.stringify(result).includes(fakeKey));
});
test("insufficient user credits are explained without exposing credentials", async () => {
  const fetcher = (async () => new Response(fakeKey, { status: 402 })) as typeof fetch;
  await assert.rejects(
    runOpenRouter(fakeKey, "openai/gpt-4.1-mini", campaign, copy, fetcher),
    (error) =>
      error instanceof Error &&
      /needs credits/.test(error.message) &&
      !error.message.includes(fakeKey),
  );
});
test("invalid model or missing key cannot trigger an upstream call", async () => {
  const fetcher = (() => {
    throw new Error("Must not be called");
  }) as typeof fetch;
  await assert.rejects(
    runOpenRouter("", "openai/gpt-4.1-mini", campaign, copy, fetcher),
    /Reconnect your OpenRouter/,
  );
  await assert.rejects(
    runOpenRouter(fakeKey, "https://attacker.example", campaign, copy, fetcher),
    /supported review model/,
  );
});
test("provider errors are actionable and never echo provider bodies or keys", async () => {
  const quota = (async () =>
    new Response(`Private provider body ${fakeKey}`, { status: 429 })) as typeof fetch;
  await assert.rejects(
    runOpenRouter(fakeKey, "openai/gpt-4.1-mini", campaign, copy, quota),
    (error) =>
      error instanceof Error &&
      /rate limit/.test(error.message) &&
      !error.message.includes(fakeKey),
  );
  const denied = (async () => new Response("sensitive", { status: 403 })) as typeof fetch;
  await assert.rejects(
    runOpenRouter(fakeKey, "openai/gpt-4.1-mini", campaign, copy, denied),
    /Reconnect in Connect AI/,
  );
});
test("truncated and malformed AI responses cannot become saved findings", async () => {
  const truncated = (async () =>
    Response.json({
      choices: [{ finish_reason: "length", message: { content: JSON.stringify(good) } }],
    })) as typeof fetch;
  await assert.rejects(
    runOpenRouter(fakeKey, "openai/gpt-4.1-mini", campaign, copy, truncated),
    /could not finish/,
  );
  const malformed = (async () =>
    Response.json({
      choices: [{ finish_reason: "stop", message: { content: "<html>not json</html>" } }],
    })) as typeof fetch;
  await assert.rejects(
    runOpenRouter(fakeKey, "openai/gpt-4.1-mini", campaign, copy, malformed),
    /unreadable/,
  );
});
test("human-only reminders and inapplicable affiliate findings are rejected", () => {
  const reminder = structuredClone(good);
  reminder.findings[0].policyId = "CP-06";
  assert.throws(() => validateAnalysis(reminder, campaign, copy, "test-model"), /incomplete/);
  const affiliate = structuredClone(good);
  affiliate.findings[0].policyId = "CP-04";
  assert.throws(
    () => validateAnalysis(affiliate, { ...campaign, channel: "Website" }, copy, "test-model"),
    /could not be verified/,
  );
});
test("unfinished AI placeholders are withheld while grounded findings remain usable", () => {
  const raw = structuredClone(good);
  raw.proposedCopy = "Explore a ClearPath loan. [Insert verified APR and repayment terms.]";
  const result = validateAnalysis(raw, campaign, copy, "test-model");
  assert.equal(result.proposedCopy, "");
  assert.ok(result.findings.length > 0);
  assert.match(result.warnings[0], /unfinished placeholders/);
});
