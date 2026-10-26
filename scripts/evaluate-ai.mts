import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { runAnthropic, SPONSORED_MODEL, reviewMessages } from "../lib/ai";
import { seedWorkspace } from "../lib/domain";
import { REVIEW_CASES, HOLDOUT_CASES } from "../tests/fixtures/ai-cases";

if (!process.argv.includes("--live"))
  throw new Error("Live inference is opt-in. Pass --live with an approved budget.");
const budget = Number(process.argv.find((a) => a.startsWith("--budget-usd="))?.split("=")[1]);
if (!Number.isFinite(budget) || budget <= 0 || budget > 5)
  throw new Error("Set an explicit approved budget between $0 and $5.");
const key = process.env.ANTHROPIC_API_KEY || "";
if (!key) throw new Error("Configure ANTHROPIC_API_KEY locally; never pass a key as an argument.");
const dir = `outputs/ai-eval/${new Date().toISOString().replace(/[:.]/g, "-")}`;
await mkdir(dir, { recursive: true });
const cases = process.argv.includes("--drafts")
  ? REVIEW_CASES.slice(0, 3)
  : process.argv.includes("--holdout")
    ? HOLDOUT_CASES
    : REVIEW_CASES;
let reserved = 0,
  estimated = 0;
const receipts: any[] = [];
const reservationPerRequest = 0.05;
for (const item of cases) {
  if (reserved + reservationPerRequest > budget)
    throw new Error("Stopped before exceeding the reserved evaluation budget.");
  const campaign = {
    ...seedWorkspace().campaigns[0],
    product: item.product,
    channel: item.channel,
    partner: item.channel === "Affiliate" ? "Fictional Partner" : "ClearPath",
  };
  const requestText = JSON.stringify(reviewMessages(campaign, item.copy));
  if (Buffer.byteLength(requestText) > 30000)
    throw new Error("Evaluation input exceeds the conservative admission bound.");
  reserved += reservationPerRequest;
  const start = Date.now();
  const receipt: any = {
    id: item.id,
    model: SPONSORED_MODEL,
    requestHash: createHash("sha256").update(requestText).digest("hex"),
    reservationUsd: reservationPerRequest,
    at: new Date().toISOString(),
  };
  await appendFile(`${dir}/admissions.jsonl`, JSON.stringify(receipt) + "\n");
  try {
    const result = await runAnthropic(key, campaign, item.copy);
    receipt.usage = result.usage;
    receipt.estimatedCostUsd =
      ((result.usage?.inputTokens || 0) * 0.1 + (result.usage?.outputTokens || 0) * 0.5) / 1e6;
    estimated += receipt.estimatedCostUsd;
    const aiPolicies = new Set(
      result.findings.filter((f) => f.origin === "ai").map((f) => f.policyId),
    );
    receipt.missingExpectedPolicies = item.expectedPolicies.filter((p) => !aiPolicies.has(p));
    receipt.unexpectedBenignFindings = item.benign
      ? result.findings.filter((f) => f.origin === "ai").map((f) => f.title)
      : [];
    receipt.validated = true;
    receipt.usableDraft = Boolean(result.proposedCopy);
    receipt.passed =
      receipt.missingExpectedPolicies.length === 0 &&
      receipt.unexpectedBenignFindings.length === 0 &&
      (!process.argv.includes("--drafts") || receipt.usableDraft);
    receipt.result = result;
  } catch (error) {
    receipt.validated = false;
    receipt.passed = false;
    receipt.error = error instanceof Error ? error.message : "Review failed";
  }
  receipt.durationMs = Date.now() - start;
  receipts.push(receipt);
  await appendFile(`${dir}/receipts.jsonl`, JSON.stringify(receipt) + "\n");
  console.log(
    JSON.stringify({
      id: item.id,
      passed: receipt.passed,
      validated: receipt.validated,
      missing: receipt.missingExpectedPolicies,
      benignFindings: receipt.unexpectedBenignFindings,
      error: receipt.error,
      estimatedCostUsd: receipt.estimatedCostUsd,
    }),
  );
  if (!receipt.validated) break;
}
const summary = {
  at: new Date().toISOString(),
  model: SPONSORED_MODEL,
  provider: "Anthropic direct",
  suite: process.argv.includes("--drafts")
    ? "usable-drafts"
    : process.argv.includes("--holdout")
      ? "holdout"
      : "regression",
  cases: receipts.length,
  passed: receipts.filter((r) => r.passed).length,
  validated: receipts.filter((r) => r.validated).length,
  benignCases: receipts.filter((r) => cases.find((c) => c.id === r.id)?.benign).length,
  benignClean: receipts.filter((r) => cases.find((c) => c.id === r.id)?.benign && r.passed).length,
  reservedUsd: reserved,
  estimatedCostUsd: estimated,
  budgetUsd: budget,
  pricingSource: "https://platform.claude.com/docs/en/models/haiku-5-5/overview",
  results: receipts.map(({ result, ...r }) => r),
  limitations:
    "Small hand-authored fictional checklist regression set; not legal accuracy or throughput evidence. Raw responses and failures are retained locally. Price estimate is not a provider billing receipt.",
};
await writeFile(`${dir}/summary.json`, JSON.stringify(summary, null, 2));
await writeFile(
  "outputs/ai-eval/latest.json",
  JSON.stringify({ directory: dir, ...summary }, null, 2),
);
console.log(
  JSON.stringify({
    directory: dir,
    passed: summary.passed,
    cases: summary.cases,
    validated: summary.validated,
    reservedUsd: reserved,
    estimatedCostUsd: estimated,
  }),
);
if (summary.passed !== cases.length) process.exitCode = 1;
