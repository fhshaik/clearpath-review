import test from "node:test";
import assert from "node:assert/strict";
import { runAnthropic, AI_JSON_SCHEMA, SPONSORED_MODEL } from "../lib/ai";
import { seedWorkspace, currentVersion } from "../lib/domain";
const campaign = seedWorkspace().campaigns[0],
  copy = currentVersion(campaign).copy;
const key = "sk-ant-FAKE_KEY_FOR_TESTS_ONLY_1234567890";
const raw = {
  summary: "Review the approval claim and missing disclosure context.",
  findings: [
    {
      policyId: "CP-01",
      severity: "high",
      title: "Unqualified approval promise",
      quote: "Guaranteed approval",
      explanation: "The claim promises a result that depends on underwriting.",
      suggestion: "Qualify the approval statement.",
    },
  ],
  proposedCopy: "Explore your options. Approval is subject to eligibility and underwriting.",
};
const success = (value: unknown = raw, stop = "end_turn") =>
  Response.json({
    stop_reason: stop,
    content: [
      { type: "thinking", thinking: "not exposed" },
      { type: "text", text: JSON.stringify(value) },
    ],
    usage: { input_tokens: 1500, output_tokens: 500 },
  });
test("sponsored provider uses a fixed Anthropic endpoint and server header only", async () => {
  const result = await runAnthropic(key, campaign, copy, (async (url, init) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(init?.redirect, "error");
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers["x-api-key"], key);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, SPONSORED_MODEL);
    assert.equal(body.max_tokens, 3500);
    assert.equal(body.tools, undefined);
    assert.equal(body.output_config.format.type, "json_schema");
    assert.equal(body.messages.length, 1);
    assert.equal(JSON.parse(body.messages[0].content).creative, copy);
    assert.ok(!String(init?.body).includes(key));
    assert.equal(body.output_config.format.schema.properties.findings.maxItems, undefined);
    return success();
  }) as typeof fetch);
  assert.equal(result.model, SPONSORED_MODEL);
  assert.equal(result.mode, "live");
  assert.deepEqual(result.usage, { inputTokens: 1500, outputTokens: 500 });
  assert.ok(!JSON.stringify(result).includes("not exposed"));
  assert.equal(AI_JSON_SCHEMA.properties.findings.maxItems, 8);
});
for (const status of [400, 401, 403, 429, 500, 529])
  test(`provider ${status} never echoes its body or key`, async () => {
    await assert.rejects(
      runAnthropic(
        key,
        campaign,
        copy,
        (async () => new Response(`secret ${key}`, { status })) as typeof fetch,
      ),
      (e) => e instanceof Error && !e.message.includes(key) && !e.message.includes("secret"),
    );
  });
test("malformed, truncated, and ungrounded results never become live reviews", async () => {
  for (const response of [
    new Response("not json"),
    success(raw, "max_tokens"),
    success({ ...raw, findings: [{ ...raw.findings[0], quote: "Invented exact evidence" }] }),
    success({ ...raw, proposedCopy: "x".repeat(6001) }),
  ])
    await assert.rejects(runAnthropic(key, campaign, copy, (async () => response) as typeof fetch));
});
test("missing key and network errors fail without retrying", async () => {
  let calls = 0;
  const transport = (async () => {
    calls++;
    throw new Error("Private network diagnostic");
  }) as typeof fetch;
  await assert.rejects(runAnthropic("", campaign, copy, transport));
  assert.equal(calls, 0);
  await assert.rejects(runAnthropic(key, campaign, copy, transport), /did not respond/);
  assert.equal(calls, 1);
});
