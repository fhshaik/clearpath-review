import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, currentVersion, policyChecks, seedWorkspace } from "../lib/domain";
import { csvCell, wordDiff } from "../lib/presentation";

test("a reviewer cannot approve unresolved or confirmed findings", () => {
  let workspace = seedWorkspace();
  const campaign = workspace.campaigns[0];
  const approve = { type: "decision" as const, role: "reviewer" as const, campaignId: campaign.id, decision: "approved" as const, note: "", attested: true };
  assert.throws(() => applyAction(workspace, approve), /Resolve findings/);
  const finding = currentVersion(campaign).analysis.findings[0];
  workspace = applyAction(workspace, { type: "disposition", role: "reviewer", campaignId: campaign.id, findingId: finding.id, disposition: "confirmed", reason: "" });
  assert.throws(() => applyAction(workspace, approve), /Resolve findings/);
});
test("dismissals require reasons; approval requires separate human attestation", () => {
  let workspace = seedWorkspace(); const campaign = workspace.campaigns[0];
  assert.throws(() => applyAction(workspace, { type: "disposition", role: "reviewer", campaignId: campaign.id, findingId: currentVersion(campaign).analysis.findings[0].id, disposition: "dismissed", reason: "" }), /at least 8/);
  for (const finding of currentVersion(campaign).analysis.findings) workspace = applyAction(workspace, { type: "disposition", role: "reviewer", campaignId: campaign.id, findingId: finding.id, disposition: "dismissed", reason: "Verified final placement and supporting offer documentation." });
  const action = { type: "decision" as const, role: "reviewer" as const, campaignId: campaign.id, decision: "approved" as const, note: "", attested: false };
  assert.throws(() => applyAction(workspace, action), /Confirm that you reviewed/);
  workspace = applyAction(workspace, { ...action, attested: true });
  assert.equal(workspace.campaigns[0].status, "approved");
  assert.equal(currentVersion(workspace.campaigns[0]).decision?.actor, "Alex Morgan");
});
test("request -> corrected revision -> approval keeps previous creative and decision", () => {
  let workspace = seedWorkspace(); const original = structuredClone(workspace.campaigns[0]);
  workspace = applyAction(workspace, { type: "decision", role: "reviewer", campaignId: original.id, decision: "changes_requested", note: "Remove the approval guarantee and add verified disclosures.", attested: false });
  const oldVersion = structuredClone(currentVersion(workspace.campaigns[0]));
  const copy = oldVersion.analysis.proposedCopy;
  assert.ok(copy.length > 20);
  workspace = applyAction(workspace, { type: "revise", role: "marketer", campaignId: original.id, copy, note: "Removed guarantee; updated rate language and compensation disclosure." });
  const revised = workspace.campaigns[0];
  assert.equal(revised.status, "in_review");
  assert.equal(currentVersion(revised).number, 2);
  assert.deepEqual(revised.versions[0], oldVersion);
  assert.equal(currentVersion(revised).analysis.mode, "none");
  assert.equal(currentVersion(revised).analysis.findings.length, 0);
  workspace = applyAction(workspace, { type: "decision", role: "reviewer", campaignId: original.id, decision: "approved", note: "Verified terms and placement.", attested: true });
  assert.equal(workspace.campaigns[0].versions[0].decision?.kind, "changes_requested");
  assert.equal(workspace.campaigns[0].versions[1].decision?.kind, "approved");
});
test("editing an approved campaign starts a new review without inheriting approval", () => {
  let workspace = seedWorkspace(); const approved = workspace.campaigns.find(c => c.status === "approved")!;
  const oldVersion = structuredClone(currentVersion(approved));
  workspace = applyAction(workspace, { type: "revise", role: "marketer", campaignId: approved.id, copy: `${oldVersion.copy}\n\nLearn more about your options.`, note: "Updated call to action." });
  const campaign = workspace.campaigns.find(c => c.id === approved.id)!;
  assert.equal(campaign.status, "in_review");
  assert.equal(currentVersion(campaign).decision, undefined);
  assert.deepEqual(campaign.versions[0], oldVersion);
});
test("a failed mutation leaves the original workspace untouched", () => {
  const workspace = seedWorkspace(); const before = structuredClone(workspace);
  assert.throws(() => applyAction(workspace, { type: "decision", role: "reviewer", campaignId: workspace.campaigns[0].id, decision: "approved", note: "", attested: true }));
  assert.deepEqual(workspace, before);
});
test("a recorded decision cannot be overwritten without a new version", () => {
  const workspace = seedWorkspace(); const approved = workspace.campaigns.find(c => c.status === "approved")!;
  assert.throws(() => applyAction(workspace, { type: "decision", role: "reviewer", campaignId: approved.id, decision: "changes_requested", note: "Changing previous decision.", attested: false }), /already has a decision/);
});
test("demo roles enforce the workflow, without claiming production authentication", () => {
  const workspace = seedWorkspace(); const campaign = workspace.campaigns[0];
  assert.throws(() => applyAction(workspace, { type: "revise", role: "reviewer", campaignId: campaign.id, copy: "A different revised campaign with sufficient copy.", note: "" }), /Switch to Marketing/);
  assert.throws(() => applyAction(workspace, { type: "decision", role: "marketer", campaignId: campaign.id, decision: "approved", note: "", attested: true }), /Switch to Compliance/);
});
test("obvious negative guarantee statements are not flagged as guarantees", () => {
  assert.ok(policyChecks("Guaranteed approval. Apply today.", "Personal loan", "Email").some(f => f.policyId === "CP-01"));
  assert.ok(!policyChecks("There is no guaranteed approval. Underwriting applies.", "Personal loan", "Email").some(f => f.policyId === "CP-01"));
});
test("product-specific checks remain scoped to the correct product", () => {
  assert.ok(policyChecks("Get 0% introductory APR. Apply now.", "Credit card", "Email").some(f => f.policyId === "CP-03"));
  assert.ok(!policyChecks("Get prequalified. Approval is subject to underwriting.", "Mortgage prequalification", "Website").some(f => f.policyId === "CP-05"));
  assert.ok(!policyChecks("Explore your mortgage options.", "Personal loan", "Website").some(f => f.policyId === "CP-05"));
});
test("CSV exports neutralize spreadsheet formulas and preserve quotes", () => {
  assert.equal(csvCell('=HYPERLINK("https://example.com")'), '"\'=HYPERLINK(""https://example.com"")"');
  assert.equal(csvCell("  +SUM(1,2)"), '"\'  +SUM(1,2)"');
  assert.equal(csvCell('A "clear" path'), '"A ""clear"" path"');
});
test("version comparison preserves both exact texts", () => {
  const before = "Guaranteed approval.\n\nApply today.", after = "Subject to approval.\n\nExplore options today.";
  const pieces = wordDiff(before, after);
  assert.equal(pieces.filter(p => p.kind !== "add").map(p => p.text).join(""), before);
  assert.equal(pieces.filter(p => p.kind !== "remove").map(p => p.text).join(""), after);
});
