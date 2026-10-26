import assert from "node:assert/strict";
const base = new URL(process.argv[2] || "http://localhost:5173"),
  checks = [];
let cookie = "",
  state;
const request = async (path, method = "GET", body, session = cookie, headers = {}) => {
  const response = await fetch(new URL(path, base), {
    method,
    redirect: "error",
    headers: {
      ...(session ? { Cookie: session } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json", Origin: base.origin } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { response, data };
};
const load = async () => {
  const r = await request("/api/workspace");
  assert.equal(r.response.status, 200);
  state = r.data;
  return r;
};
const initial = await load();
cookie = initial.response.headers.get("set-cookie").split(";")[0];
const campaign = state.workspace.campaigns[0],
  id = campaign.id;
const mutate = async (action, expected = 200) => {
  const r = await request("/api/workspace", "POST", { revision: state.revision, action });
  assert.equal(r.response.status, expected, JSON.stringify(r.data));
  if (expected === 200) state = r.data;
  return r;
};
const decision = (
  decision,
  attested = true,
  note = "Reviewed fictional terms for the integration test.",
) => ({ type: "decision", role: "reviewer", campaignId: id, decision, attested, note });
assert.equal(
  (await request("/api/workspace", "POST", { revision: 0, action: decision("approved") }, ""))
    .response.status,
  401,
);
assert.equal((await request("/api/workspace", "POST", "{broken")).response.status, 400);
assert.equal(
  (
    await request("/api/workspace", "POST", {
      revision: 0,
      action: { type: "reset", role: "admin" },
    })
  ).response.status,
  400,
);
checks.push("Malformed payloads, missing sessions and invented roles are rejected");
const quotaBefore = (await request("/api/ai/status")).data;
for (const body of [
  {
    revision: state.revision,
    campaignId: id,
    version: 1,
    provider: "sponsored",
    model: "openai/gpt-4.1-mini",
  },
  {
    revision: state.revision + 1,
    campaignId: id,
    version: 1,
    provider: "sponsored",
    model: "claude-haiku-5-5",
  },
])
  assert.ok([400, 409].includes((await request("/api/analyze", "POST", body)).response.status));
assert.equal((await request("/api/ai/status")).data.remaining, quotaBefore.remaining);
checks.push("Invalid provider/model combinations and stale AI requests consume no allowance");
await mutate({ ...decision("approved"), role: "marketer" }, 400);
await mutate(decision("approved"), 400);
await mutate(decision("changes_requested", false, "short"), 400);
const finding = campaign.versions[0].analysis.findings[0];
await mutate({
  type: "disposition",
  role: "reviewer",
  campaignId: id,
  findingId: finding.id,
  disposition: "confirmed",
  reason: "",
});
assert.equal(
  (
    await request("/api/analyze", "POST", {
      revision: state.revision,
      campaignId: id,
      version: 1,
      provider: "sponsored",
      model: "claude-haiku-5-5",
    })
  ).response.status,
  400,
);
assert.equal((await request("/api/ai/status")).data.remaining, quotaBefore.remaining);
checks.push("Human dispositions prevent AI from replacing recorded review judgments");
await mutate(
  decision("changes_requested", false, "Remove the guarantee and add verified disclosures."),
);
const versionOne = structuredClone(state.workspace.campaigns[0].versions[0]);
await mutate(
  { type: "revise", role: "marketer", campaignId: id, copy: versionOne.copy, note: "" },
  400,
);
await mutate({
  type: "revise",
  role: "marketer",
  campaignId: id,
  copy: versionOne.analysis.proposedCopy,
  note: "Removed guarantee, changed rate copy, added compensation disclosure.",
});
assert.equal(state.workspace.campaigns[0].versions[1].analysis.mode, "none");
assert.equal(state.workspace.campaigns[0].versions[1].analysis.findings.length, 0);
assert.deepEqual(state.workspace.campaigns[0].versions[0], versionOne);
checks.push("Requested changes, corrected copy and prior decisions persist as separate versions");
await mutate(decision("approved", false), 400);
await mutate(decision("approved"));
assert.equal(state.workspace.campaigns[0].status, "approved");
await mutate(decision("changes_requested"), 400);
await load();
assert.equal(state.workspace.campaigns[0].versions[1].decision.kind, "approved");
checks.push("Approval requires attestation, survives reload, and cannot overwrite history");
await mutate({
  type: "comment",
  role: "marketer",
  campaignId: id,
  note: "Verified fictional offer context.",
});
assert.equal(state.workspace.events[0].actor, "Jamie Chen");
await mutate({
  type: "revise",
  role: "marketer",
  campaignId: id,
  copy: versionOne.analysis.proposedCopy + "\n\nExplore your options today.",
  note: "Updated CTA.",
});
assert.equal(state.workspace.campaigns[0].versions[2].decision, undefined);
assert.equal(state.workspace.campaigns[0].status, "in_review");
await mutate(
  { type: "comment", role: "reviewer", campaignId: "missing", note: "A valid note" },
  404,
);
checks.push("Comments retain actor identity and new versions never inherit approval");
if (process.argv.includes("--live")) {
  const r = await request("/api/analyze", "POST", {
    revision: state.revision,
    campaignId: id,
    version: 3,
    provider: "sponsored",
    model: "claude-haiku-5-5",
  });
  assert.equal(r.response.status, 200, JSON.stringify(r.data));
  state = r.data;
  const result = state.workspace.campaigns[0].versions[2].analysis;
  assert.equal(
    result.findings.length,
    0,
    "Corrected generic copy should not get invented findings",
  );
  assert.equal(result.mode, "live");
  assert.equal(result.model, "claude-haiku-5-5");
  assert.ok(result.usage.inputTokens > 0);
  assert.ok(!JSON.stringify(r.data).includes("sk-ant-"));
  assert.equal((await request("/api/ai/status")).data.remaining, quotaBefore.remaining - 1);
  const immediate = await request("/api/analyze", "POST", {
    revision: state.revision,
    campaignId: id,
    version: 3,
    provider: "sponsored",
    model: "claude-haiku-5-5",
  });
  assert.equal(immediate.response.status, 429);
  const savedRevision = state.revision;
  await load();
  assert.equal(state.revision, savedRevision);
  assert.deepEqual(state.workspace.campaigns[0].versions[2].analysis, result);
  checks.push(
    "Real Anthropic generation saves validated findings and usage, survives reload, exposes no key, and enforces its rate limit",
  );
  console.log(
    JSON.stringify({
      liveUsage: result.usage,
      estimatedCostUsd: (result.usage.inputTokens * 0.1 + result.usage.outputTokens * 0.5) / 1e6,
    }),
  );
}
await mutate({ type: "reset", role: "reviewer" });
assert.equal(state.workspace.campaigns.length, 8);
assert.equal(state.workspace.campaigns[0].versions.length, 1);
assert.equal(
  (await request("/api/ai/status")).data.remaining,
  quotaBefore.remaining - (process.argv.includes("--live") ? 1 : 0),
);
checks.push(
  "Reset restores fictional campaigns while maintaining the session and revision sequence",
);
console.log(
  JSON.stringify(
    { target: base.origin, passed: checks.length, live: process.argv.includes("--live"), checks },
    null,
    2,
  ),
);
