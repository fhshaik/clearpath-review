import test from "node:test";
import assert from "node:assert/strict";
import { runGemini, validateAnalysis } from "../lib/ai";
import { currentVersion, seedWorkspace } from "../lib/domain";

const campaign = seedWorkspace().campaigns[0];
const copy = currentVersion(campaign).copy;
const good = { summary: "The approval guarantee needs qualification and substantiation.", findings: [{ policyId: "CP-01", severity: "high", title: "Unqualified approval claim", quote: "Guaranteed approval", explanation: "This is an unconditional claim about an underwriting outcome.", suggestion: "Replace it with qualified eligibility language." }], proposedCopy: "Explore your options. Approval is subject to eligibility and underwriting." };
const fakeKey = "NOT_A_REAL_KEY_FOR_TESTING_ONLY_123456";

test("AI evidence must be an exact substring of the submitted creative", () => {
  const bad = structuredClone(good); bad.findings[0].quote = "An invented claim absent from this creative";
  assert.throws(() => validateAnalysis(bad, campaign, copy, "test-model"), /could not be verified/);
});
test("AI cannot cite unknown or inapplicable policy IDs", () => {
  const unknown = structuredClone(good); unknown.findings[0].policyId = "FAKE-42";
  assert.throws(() => validateAnalysis(unknown, campaign, copy, "test-model"), /incomplete review/);
  const wrongProduct = structuredClone(good); wrongProduct.findings[0].policyId = "CP-03";
  assert.throws(() => validateAnalysis(wrongProduct, campaign, copy, "test-model"), /could not be verified/);
});
test("AI rewrites introducing new numerical terms are withheld", () => {
  const raw = structuredClone(good); raw.proposedCopy = "Explore loans at 4.75% APR for 72 months.";
  const result = validateAnalysis(raw, campaign, copy, "test-model");
  assert.equal(result.proposedCopy, ""); assert.equal(result.warnings.length, 1);
});
test("a live result retains deterministic policies omitted by the model", () => {
  const result = validateAnalysis(good, campaign, copy, "test-model");
  assert.equal(result.mode, "live");
  assert.ok(result.findings.some(f => f.policyId === "CP-01" && f.origin === "ai"));
  assert.ok(result.findings.some(f => f.policyId === "CP-02" && f.origin === "policy"));
  assert.ok(result.findings.some(f => f.policyId === "CP-04" && f.origin === "policy"));
});
test("an unrelated AI finding cannot erase a deterministic concern under the same policy", () => {
  const raw = structuredClone(good); raw.findings[0].quote = "Check your rate in minutes.";
  const result = validateAnalysis(raw, campaign, copy, "test-model");
  assert.ok(result.findings.some(f => f.origin === "policy" && f.quote === "Guaranteed approval"));
});
test("AI keys go only in a header to a fixed Google endpoint; creative is data", async () => {
  let calls = 0;
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    assert.ok(!String(url).includes(fakeKey));
    assert.equal((init?.headers as Record<string, string>)["x-goog-api-key"], fakeKey);
    const body = JSON.parse(init?.body as string);
    assert.ok(!JSON.stringify(body).includes(fakeKey));
    assert.equal(JSON.parse(body.contents[0].parts[0].text).creative, copy);
    assert.match(body.systemInstruction.parts[0].text, /untrusted advertising data/);
    assert.equal(body.tools, undefined);
    assert.equal(body.generationConfig.temperature, undefined);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "low" });
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(good) }] } }] });
  }) as typeof fetch;
  const result = await runGemini(fakeKey, "gemini-3.8-flash", campaign, copy, fetcher);
  assert.equal(calls, 1); assert.equal(result.mode, "live"); assert.ok(!JSON.stringify(result).includes(fakeKey));
});
test("Flash-Lite uses the current model endpoint and its supported minimal thinking level", async () => {
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    const body = JSON.parse(init?.body as string);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "minimal" });
    assert.equal(body.generationConfig.temperature, undefined);
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(good) }] } }] });
  }) as typeof fetch;
  assert.equal((await runGemini(fakeKey, "gemini-3.5-flash-lite", campaign, copy, fetcher)).mode, "live");
});
test("invalid model or missing key cannot trigger an upstream call", async () => {
  const fetcher = (() => { throw new Error("Must not be called"); }) as typeof fetch;
  await assert.rejects(runGemini("", "gemini-3.8-flash", campaign, copy, fetcher), /valid Gemini API key/);
  await assert.rejects(runGemini(fakeKey, "https://attacker.example", campaign, copy, fetcher), /supported Gemini/);
});
test("provider errors are actionable and never echo provider bodies or keys", async () => {
  const quota = (async () => new Response(`Private provider body ${fakeKey}`, { status: 429 })) as typeof fetch;
  await assert.rejects(runGemini(fakeKey, "gemini-3.8-flash", campaign, copy, quota), error => error instanceof Error && /quota/.test(error.message) && !error.message.includes(fakeKey));
  const denied = (async () => new Response("sensitive", { status: 403 })) as typeof fetch;
  await assert.rejects(runGemini(fakeKey, "gemini-3.8-flash", campaign, copy, denied), /Check your API key/);
});
test("truncated and malformed AI responses cannot become saved findings", async () => {
  const truncated = (async () => Response.json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: JSON.stringify(good) }] } }] })) as typeof fetch;
  await assert.rejects(runGemini(fakeKey, "gemini-3.8-flash", campaign, copy, truncated), /could not finish/);
  const malformed = (async () => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "<html>not json</html>" }] } }] })) as typeof fetch;
  await assert.rejects(runGemini(fakeKey, "gemini-3.8-flash", campaign, copy, malformed), /unreadable/);
});
