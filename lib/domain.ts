export type Product = "Personal loan" | "Credit card" | "Mortgage prequalification";
export type Channel = "Email" | "Paid social" | "Affiliate" | "Website";
export type Status = "in_review" | "changes_requested" | "approved";
export type Role = "reviewer" | "marketer";
export type Severity = "high" | "medium" | "low";
export type Disposition = "open" | "confirmed" | "dismissed";

export interface Policy {
  id: string;
  title: string;
  description: string;
  guidance: string;
  source: string;
  sourceLabel: string;
  products: Product[];
}
export const PRODUCTS: Product[] = ["Personal loan", "Credit card", "Mortgage prequalification"];
export const CHANNELS: Channel[] = ["Email", "Paid social", "Affiliate", "Website"];
export const POLICY_VERSION = "CP-2026.10 · v1";
export const POLICIES: Policy[] = [
  {
    id: "CP-01",
    title: "Claims must be supportable",
    description:
      "Flag absolute approval, eligibility, savings, or credit-impact claims for substantiation.",
    guidance:
      "Avoid promising an outcome that depends on underwriting. Ask for evidence or qualify the claim.",
    source:
      "https://www.consumerfinance.gov/compliance/supervision-examinations/unfair-deceptive-or-abusive-acts-or-practices-udaaps-examination-procedures/",
    sourceLabel: "CFPB · UDAAP examination guidance",
    products: PRODUCTS,
  },
  {
    id: "CP-02",
    title: "Rates need the right context",
    description: "Review advertised rates and payment terms for APR and applicable disclosures.",
    guidance:
      "Check the product-specific advertising requirements, APR, repayment terms, and prominence. The presence of 'APR' alone is not a complete review.",
    source: "https://www.consumerfinance.gov/rules-policy/regulations/1026/24/",
    sourceLabel: "Regulation Z · §1026.24(c–d)",
    products: ["Personal loan", "Mortgage prequalification"],
  },
  {
    id: "CP-03",
    title: "Promotional credit-card terms",
    description: "Review introductory-rate duration, subsequent APR, fees, and offer limitations.",
    guidance:
      "Identify when the introductory period ends and the terms that apply afterward. Check all applicable card advertising disclosures.",
    source: "https://www.consumerfinance.gov/rules-policy/regulations/1026/16/",
    sourceLabel: "Regulation Z · §1026.16(g)",
    products: ["Credit card"],
  },
  {
    id: "CP-04",
    title: "Affiliate relationships are disclosed",
    description: "Check that compensated partner content explains the material relationship.",
    guidance:
      "Confirm that the relationship is disclosed clearly and conspicuously in the final placement. Text review cannot verify placement or visual prominence.",
    source:
      "https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking",
    sourceLabel: "FTC · Endorsement Guides FAQ",
    products: PRODUCTS,
  },
  {
    id: "CP-05",
    title: "Prequalification is not approval",
    description:
      "ClearPath policy requires prequalification copy to distinguish an estimate from a commitment to lend.",
    guidance:
      "Use precise language about prequalification, underwriting, and final approval. Do not turn an initial estimate into a guarantee.",
    source: "https://www.ecfr.gov/current/title-12/chapter-X/part-1014/section-1014.3",
    sourceLabel: "Regulation N · §1014.3",
    products: ["Mortgage prequalification"],
  },
  {
    id: "CP-06",
    title: "A human reviews the complete creative",
    description:
      "ClearPath policy requires a reviewer to check context, substantiation, and the final disclosure placement before approval.",
    guidance:
      "Automated checks are incomplete. Review audience, eligibility, linked terms, readability, and final placement before recording a decision.",
    source: "",
    sourceLabel: "ClearPath internal demo policy",
    products: PRODUCTS,
  },
];

export interface Finding {
  id: string;
  policyId: string;
  severity: Severity;
  title: string;
  quote: string;
  explanation: string;
  suggestion: string;
  origin: "policy" | "sample" | "ai";
  disposition: Disposition;
  reason?: string;
}
export interface Analysis {
  mode: "none" | "sample" | "live";
  summary: string;
  findings: Finding[];
  proposedCopy: string;
  model?: string;
  analyzedAt?: string;
  warnings: string[];
  usage?: { inputTokens: number; outputTokens: number };
}
export interface Version {
  number: number;
  copy: string;
  createdAt: string;
  author: string;
  analysis: Analysis;
  decision?: { kind: "approved" | "changes_requested"; at: string; actor: string; note: string };
}
export interface Campaign {
  id: string;
  name: string;
  product: Product;
  channel: Channel;
  partner: string;
  owner: string;
  dueAt: string;
  createdAt: string;
  status: Status;
  versions: Version[];
}
export interface AuditEvent {
  id: string;
  campaignId: string;
  campaignName: string;
  version: number;
  action: string;
  actor: string;
  at: string;
  detail: string;
}
export interface Workspace {
  campaigns: Campaign[];
  events: AuditEvent[];
  createdAt: string;
}
export interface Envelope {
  workspace: Workspace;
  revision: number;
}
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export const currentVersion = (campaign: Campaign) =>
  campaign.versions[campaign.versions.length - 1];
export const actorName = (role: Role) => (role === "reviewer" ? "Alex Morgan" : "Jamie Chen");
export const statusLabel = (status: Status) =>
  ({ in_review: "In review", changes_requested: "Changes requested", approved: "Approved" })[
    status
  ];
export const activeFindings = (version: Version) =>
  version.analysis.findings.filter((f) => f.disposition !== "dismissed");
export function riskLevel(campaign: Campaign): "high" | "medium" | "low" {
  const findings = activeFindings(currentVersion(campaign));
  return findings.some((f) => f.severity === "high")
    ? "high"
    : findings.some((f) => f.severity === "medium")
      ? "medium"
      : "low";
}
export function addEvent(
  workspace: Workspace,
  campaign: Campaign,
  role: Role,
  action: string,
  detail: string,
  at = new Date().toISOString(),
) {
  workspace.events.unshift({
    id: crypto.randomUUID(),
    campaignId: campaign.id,
    campaignName: campaign.name,
    version: currentVersion(campaign).number,
    action,
    actor: actorName(role),
    at,
    detail,
  });
}

export function policyChecks(copy: string, product: Product, channel: Channel): Finding[] {
  const findings: Finding[] = [];
  const add = (
    policyId: string,
    severity: Severity,
    title: string,
    quote: string,
    explanation: string,
    suggestion: string,
  ) =>
    findings.push({
      id: crypto.randomUUID(),
      policyId,
      severity,
      title,
      quote,
      explanation,
      suggestion,
      origin: "policy",
      disposition: "open",
    });
  const absolute = [
    ...copy.matchAll(
      /\b(?:guaranteed approval|everyone is approved|100% approval|guaranteed to qualify|instant approval guaranteed)\b/gi,
    ),
  ].find(
    (match) =>
      !/\b(?:no|not|never)\s+(?:an?\s+)?$/i.test(
        copy.slice(Math.max(0, match.index - 16), match.index),
      ),
  );
  if (absolute)
    add(
      "CP-01",
      "high",
      "Unqualified approval claim",
      absolute[0],
      "This phrase promises an underwriting outcome. Verify substantiation and qualify the claim.",
      "Apply to see if you qualify. Approval is subject to eligibility and underwriting.",
    );
  const rate = /\b\d+(?:\.\d+)?\s*%/.exec(copy);
  if (rate && product !== "Credit card" && !/\bAPR\b|annual percentage rate/i.test(copy))
    add(
      "CP-02",
      "high",
      "Advertised rate needs APR review",
      rate[0],
      "A percentage rate appears without an APR label. Verify the rate and all applicable terms; adding an acronym alone may not be sufficient.",
      "State the verified APR and required product disclosures.",
    );
  if (
    product === "Credit card" &&
    /\b(?:intro(?:ductory)?|0\s*%)\b/i.test(copy) &&
    !/\b(?:then|after|thereafter|following)\b/i.test(copy)
  )
    add(
      "CP-03",
      "high",
      "Terms after the promotion are missing",
      rate?.[0] ?? "",
      "The copy mentions an introductory offer but does not explain what applies afterward.",
      "Add the verified introductory duration, subsequent APR, and applicable fees.",
    );
  if (
    channel === "Affiliate" &&
    !/\b(?:compensat\w*|commissions?|sponsored|advertisement|paid\s+(?:partnership|promotion|partner)|advertising\s+(?:partner|relationship))\b/i.test(
      copy,
    )
  )
    add(
      "CP-04",
      "medium",
      "Partner relationship needs disclosure",
      "",
      "This affiliate submission does not include an obvious compensation disclosure. Confirm the relationship and final placement.",
      "We may receive compensation if you apply through this link.",
    );
  if (
    product === "Mortgage prequalification" &&
    /\b(?:prequalif|pre-qualif)/i.test(copy) &&
    !/(?:not\s+(?:a\s+)?(?:guarantee|approval|commitment)|subject to.*(?:underwriting|approval)|does not guarantee)/i.test(
      copy,
    )
  )
    add(
      "CP-05",
      "medium",
      "Clarify what prequalification means",
      "",
      "ClearPath's demo checklist requires a distinction between initial prequalification and final loan approval.",
      "Prequalification is not a commitment to lend. Final approval is subject to underwriting.",
    );
  return findings;
}
export function unanalysed(copy: string, product: Product, channel: Channel): Analysis {
  return {
    mode: "none",
    summary:
      "AI review has not run on this version. Basic policy checks are available; a human must review the complete creative.",
    findings: policyChecks(copy, product, channel),
    proposedCopy: "",
    warnings: [],
  };
}

export type Action =
  | {
      type: "submit";
      role: Role;
      name: string;
      product: Product;
      channel: Channel;
      partner: string;
      dueAt: string;
      copy: string;
    }
  | { type: "revise"; role: Role; campaignId: string; copy: string; note: string }
  | {
      type: "disposition";
      role: Role;
      campaignId: string;
      findingId: string;
      disposition: Disposition;
      reason: string;
    }
  | {
      type: "decision";
      role: Role;
      campaignId: string;
      decision: "approved" | "changes_requested";
      note: string;
      attested: boolean;
    }
  | { type: "comment"; role: Role; campaignId: string; note: string }
  | { type: "reset"; role: Role };

export function applyAction(original: Workspace, action: Action): Workspace {
  const workspace = structuredClone(original);
  if (action.type === "reset") return seedWorkspace();
  const at = new Date().toISOString();
  if (action.type === "submit") {
    if (action.role !== "marketer")
      throw new DomainError("Switch to Marketing to submit a campaign.");
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      name: action.name,
      product: action.product,
      channel: action.channel,
      partner: action.partner,
      owner: actorName(action.role),
      dueAt: action.dueAt,
      createdAt: at,
      status: "in_review",
      versions: [
        {
          number: 1,
          copy: action.copy,
          createdAt: at,
          author: actorName(action.role),
          analysis: unanalysed(action.copy, action.product, action.channel),
        },
      ],
    };
    workspace.campaigns.unshift(campaign);
    addEvent(
      workspace,
      campaign,
      action.role,
      "Submitted for review",
      `${campaign.product} · ${campaign.channel}`,
    );
    return workspace;
  }
  const campaign = workspace.campaigns.find((c) => c.id === action.campaignId);
  if (!campaign) throw new DomainError("This campaign could not be found.", 404);
  const version = currentVersion(campaign);
  if (action.type === "comment") {
    addEvent(workspace, campaign, action.role, "Comment added", action.note);
    return workspace;
  }
  if (action.type === "revise") {
    if (action.role !== "marketer")
      throw new DomainError("Switch to Marketing to submit a revision.");
    if (action.copy.trim() === version.copy.trim())
      throw new DomainError("Change the creative before submitting a new version.");
    campaign.versions.push({
      number: version.number + 1,
      copy: action.copy,
      createdAt: at,
      author: actorName(action.role),
      analysis: unanalysed(action.copy, campaign.product, campaign.channel),
    });
    campaign.status = "in_review";
    addEvent(
      workspace,
      campaign,
      action.role,
      "New version submitted",
      action.note ||
        "Revised creative is ready for review. Previous decisions remain on their original versions.",
    );
    return workspace;
  }
  if (action.role !== "reviewer")
    throw new DomainError("Switch to Compliance to record review decisions.");
  if (campaign.status !== "in_review")
    throw new DomainError(
      "This version already has a decision. Submit a new version to review it again.",
    );
  if (action.type === "disposition") {
    const finding = version.analysis.findings.find((f) => f.id === action.findingId);
    if (!finding) throw new DomainError("This finding could not be found.", 404);
    if (action.disposition === "dismissed" && action.reason.trim().length < 8)
      throw new DomainError("Explain why you are dismissing this finding (at least 8 characters).");
    finding.disposition = action.disposition;
    finding.reason = action.reason;
    addEvent(
      workspace,
      campaign,
      action.role,
      action.disposition === "dismissed"
        ? "Finding dismissed"
        : action.disposition === "confirmed"
          ? "Finding confirmed"
          : "Finding reopened",
      `${finding.title}${action.reason ? ` — ${action.reason}` : ""}`,
    );
    return workspace;
  }
  if (action.decision === "approved") {
    if (version.analysis.findings.some((f) => f.disposition !== "dismissed"))
      throw new DomainError(
        "Resolve findings through a corrected version or dismiss them with a reason before approval.",
      );
    if (!action.attested)
      throw new DomainError("Confirm that you reviewed the complete creative and its disclosures.");
  } else if (action.note.trim().length < 8)
    throw new DomainError("Give Marketing actionable feedback (at least 8 characters).");
  version.decision = {
    kind: action.decision,
    at,
    actor: actorName(action.role),
    note: action.note || "Reviewed complete creative, terms, and disclosure placement.",
  };
  campaign.status = action.decision;
  addEvent(
    workspace,
    campaign,
    action.role,
    action.decision === "approved" ? "Version approved" : "Changes requested",
    version.decision.note,
  );
  return workspace;
}

export function seedWorkspace(): Workspace {
  const now = Date.now();
  const iso = (hours: number) => new Date(now + hours * 3600000).toISOString();
  const workspace: Workspace = { campaigns: [], events: [], createdAt: iso(0) };
  const rows: Array<{
    id: string;
    name: string;
    product: Product;
    channel: Channel;
    partner: string;
    owner: string;
    hours: number;
    due: number;
    copy: string;
    fixed?: string;
    approved?: boolean;
    changes?: boolean;
  }> = [
    {
      id: "cp-1048",
      name: "A little breathing room",
      product: "Personal loan",
      channel: "Affiliate",
      partner: "BrightMoney",
      owner: "Jamie Chen",
      hours: -5,
      due: 20,
      copy: "A little breathing room.\n\nLife doesn't wait. Neither should your plans. Get a ClearPath personal loan from $2,000 to $35,000 with rates as low as 5.99%.\n\nGuaranteed approval. Money in your account as soon as tomorrow.\n\nCheck your rate in minutes.",
      fixed:
        "A little breathing room.\n\nExplore a ClearPath personal loan from $2,000 to $35,000. Check your eligibility and see the rates and terms available to you before deciding.\n\nApproval and funding timing depend on eligibility, verification, and underwriting.\n\nWe may receive compensation if you apply through this link.\n\nCheck your options in minutes.",
    },
    {
      id: "cp-1047",
      name: "Meet your everyday card",
      product: "Credit card",
      channel: "Email",
      partner: "ClearPath",
      owner: "Sam Rivera",
      hours: -8,
      due: 8,
      copy: "Meet your everyday card.\n\nEnjoy 0% introductory APR on purchases with the ClearPath Everyday Card. More room for the things that matter.\n\nApply today. Terms and eligibility requirements apply.",
      fixed:
        "Meet your everyday card.\n\nExplore the ClearPath Everyday Card. Review the introductory offer, subsequent APR, fees, and eligibility requirements in the full card terms before you apply.\n\nFind a card that fits your everyday.",
    },
    {
      id: "cp-1046",
      name: "Your next chapter starts here",
      product: "Mortgage prequalification",
      channel: "Paid social",
      partner: "ClearPath",
      owner: "Priya Shah",
      hours: -12,
      due: 30,
      copy: "Your next chapter starts here.\n\nThinking about a place of your own? Get prequalified for a ClearPath mortgage online and explore what your next move could look like.\n\nStart your home journey.",
      fixed:
        "Your next chapter starts here.\n\nThinking about a place of your own? Get prequalified for a ClearPath mortgage online and explore what your next move could look like.\n\nPrequalification is not a commitment to lend. Final approval is subject to underwriting.\n\nStart your home journey.",
    },
    {
      id: "cp-1045",
      name: "Make room for what matters",
      product: "Personal loan",
      channel: "Website",
      partner: "ClearPath",
      owner: "Jamie Chen",
      hours: -20,
      due: 48,
      copy: "Make room for what matters.\n\nExplore personal loan options with ClearPath. See available rates, fees, and repayment terms before you decide.\n\nApproval is subject to eligibility and underwriting. Funding times vary.\n\nExplore your options.",
    },
    {
      id: "cp-1044",
      name: "Find your financial footing",
      product: "Personal loan",
      channel: "Affiliate",
      partner: "FinanceForward",
      owner: "Sam Rivera",
      hours: -26,
      due: 12,
      changes: true,
      copy: "Find your financial footing.\n\nExplore ClearPath personal loans for your next step. Compare options and choose the terms that work for you.\n\nApproval is subject to eligibility and underwriting.",
    },
    {
      id: "cp-1043",
      name: "A clearer path home",
      product: "Mortgage prequalification",
      channel: "Website",
      partner: "ClearPath",
      owner: "Priya Shah",
      hours: -30,
      due: 72,
      approved: true,
      copy: "A clearer path home.\n\nExplore your mortgage options with ClearPath's online prequalification. Prequalification is not a commitment to lend. Final approval is subject to underwriting and verification.\n\nSee what may be possible.",
    },
    {
      id: "cp-1042",
      name: "Your card, your everyday",
      product: "Credit card",
      channel: "Paid social",
      partner: "ClearPath",
      owner: "Jamie Chen",
      hours: -35,
      due: 50,
      copy: "Your card, your everyday.\n\nExplore the ClearPath Everyday Card. Review rates, fees, rewards conditions, and eligibility requirements before applying.\n\nFind your fit. Terms apply.",
    },
    {
      id: "cp-1041",
      name: "A fresh start, on your terms",
      product: "Personal loan",
      channel: "Email",
      partner: "ClearPath",
      owner: "Sam Rivera",
      hours: -46,
      due: 36,
      approved: true,
      copy: "A fresh start, on your terms.\n\nClearPath helps you explore personal loan options. Compare available APRs, fees, and repayment terms before deciding. Approval is subject to eligibility and underwriting.\n\nTake a look at your options.",
    },
  ];
  for (const row of rows) {
    const analysis: Analysis = {
      mode: "sample",
      summary: row.fixed
        ? "This illustrative review identifies claims and disclosures that need a closer look. Confirm the underlying offer terms before requesting a revision."
        : "No issues were identified in this illustrative text review. A reviewer still needs to verify offer terms, substantiation, and final placement.",
      findings: policyChecks(row.copy, row.product, row.channel).map((f) => ({
        ...f,
        origin: "sample",
      })),
      proposedCopy: row.fixed || "",
      analyzedAt: iso(row.hours + 0.1),
      model: "Curated demo example",
      warnings: [],
    };
    const campaign: Campaign = {
      id: row.id,
      name: row.name,
      product: row.product,
      channel: row.channel,
      partner: row.partner,
      owner: row.owner,
      createdAt: iso(row.hours),
      dueAt: iso(row.due),
      status: row.approved ? "approved" : row.changes ? "changes_requested" : "in_review",
      versions: [
        { number: 1, copy: row.copy, createdAt: iso(row.hours), author: row.owner, analysis },
      ],
    };
    if (row.approved || row.changes)
      campaign.versions[0].decision = {
        kind: row.approved ? "approved" : "changes_requested",
        actor: "Alex Morgan",
        at: iso(row.hours + 2),
        note: row.approved
          ? "Reviewed creative, offer terms, and disclosure placement. Approved for this version."
          : "Please add a clear partner-compensation disclosure and resubmit the complete copy.",
      };
    workspace.campaigns.push(campaign);
    if (campaign.versions[0].decision)
      addEvent(
        workspace,
        campaign,
        "reviewer",
        row.approved ? "Version approved" : "Changes requested",
        campaign.versions[0].decision.note,
        campaign.versions[0].decision.at,
      );
    addEvent(
      workspace,
      campaign,
      "marketer",
      "Submitted for review",
      `${row.product} · ${row.channel}`,
      campaign.createdAt,
    );
    workspace.events[0].actor = row.owner;
  }
  workspace.events.sort((a, b) => b.at.localeCompare(a.at));
  return workspace;
}
