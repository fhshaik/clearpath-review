import assert from "node:assert/strict";
import { query } from "../db/client";
import { claimSponsoredReview } from "../lib/sponsored";
if (!process.argv.includes("--database"))
  throw new Error("Pass --database to test quotas against the configured Postgres database.");
const prefix = `quota-test-${crypto.randomUUID()}`;
const before = (
  await query<{ used: number }>("SELECT used FROM sponsored_budget WHERE id='demo-v1'")
)[0].used;
const budgetId = prefix + "-session",
  workspace = prefix + "-workspace",
  now = Date.now();
await query("INSERT INTO sponsored_budget (id,used) VALUES ($1,0)", [budgetId]);
const race = await Promise.allSettled(
  Array.from({ length: 10 }, () => claimSponsoredReview(workspace, { budgetId, now })),
);
assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
assert.equal(
  (await query<{ used: number }>("SELECT used FROM sponsored_budget WHERE id=$1", [budgetId]))[0]
    .used,
  1,
);
await claimSponsoredReview(workspace, { budgetId, now: now + 60001 });
await assert.rejects(claimSponsoredReview(workspace, { budgetId, now: now + 120002 }), /allowance/);
assert.equal(
  (
    await query<{ used: number }>("SELECT used FROM sponsored_sessions WHERE workspace_id=$1", [
      workspace,
    ])
  )[0].used,
  2,
);
const globalId = prefix + "-global";
await query("INSERT INTO sponsored_budget (id,used) VALUES ($1,19)", [globalId]);
const globalRace = await Promise.allSettled(
  Array.from({ length: 20 }, (_, i) =>
    claimSponsoredReview(prefix + "-global-" + i, { budgetId: globalId, now }),
  ),
);
assert.equal(globalRace.filter((r) => r.status === "fulfilled").length, 1);
assert.equal(
  (await query<{ used: number }>("SELECT used FROM sponsored_budget WHERE id=$1", [globalId]))[0]
    .used,
  20,
);
assert.equal(
  (await query<{ used: number }>("SELECT used FROM sponsored_budget WHERE id='demo-v1'"))[0].used,
  before,
);
console.log(
  JSON.stringify({
    passed: 5,
    checks: [
      "Concurrent same-session claims admit one request",
      "Rate window prevents a second immediate request",
      "Two lifetime reviews per session",
      "Global twenty-attempt cap survives concurrent claims",
      "Quota tests never consume the real demo allowance",
    ],
    inferenceCalls: 0,
    testFixturePrefix: prefix,
  }),
);
