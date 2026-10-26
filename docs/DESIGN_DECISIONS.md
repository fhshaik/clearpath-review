# Design decisions and tradeoffs

## Product judgment

**Why build a workflow instead of a chatbot?**
A review is only useful when it leads to a correction and a decision on the right
version. A standalone answer leaves the Excel/email coordination problem intact.
This design keeps the creative, evidence, feedback, revision and decision together.

**Where should throughput improve?**
Less context gathering, reusable actionable feedback, and faster comparison of
revisions. Those are hypotheses, not measured gains. I would instrument reviewer
handling time, time to first review, revision count and time to decision, with
quality sampling and overrides tracked alongside speed.

**Why text first?**
It makes evidence precise and version comparison reviewable. PDF/OCR, image
placement, affiliate crawling and linked disclosures are valuable extensions, but
would expand ingestion and review quality problems beyond this prototype.

**What happens on the visitor's first click?**
A separate fictional workspace opens immediately. Two live Anthropic attempts are
included per workspace while the global allowance lasts. No provider account is
needed for that path. OpenRouter is an optional visitor-funded extension.

## Engineering tradeoffs

**Why Next.js, Vercel and Neon?**
One TypeScript application contains the UI and API, deployment is conventional,
and Postgres provides persistence, transactions and conditional writes. This fits
a small prototype while leaving a path to normalized production storage.

**Why is a workspace stored as JSON?**
It simplifies consistent snapshots of a bounded demo and keeps domain transitions
in one pure function. The cost is whole-workspace writes and contention between
unrelated campaigns. Production should normalize campaigns, versions, findings,
memberships and events, and lock at campaign/version granularity.

**How do you prevent lost updates?**
The client sends its last revision. The final SQL update includes that revision
in its WHERE clause and increments it atomically. Zero rows means 409. AI uses
the same check after inference, so a slow result cannot overwrite a later human
action. The failed inference can still have incurred provider cost.

**How is a decision protected?**
The server rejects approval while findings remain open or confirmed and requires
an explicit attestation. A new version starts a fresh review. Prior creative and
decisions remain attached to their original versions through the application API.
Demo roles enforce the workflow, but are not a substitute for real authorization.

## AI and safety boundaries

**What can the model do?**
Return a summary, structured findings and optional proposed copy. It has no tools
or direct database/publishing action. Creative is untrusted data. Schema, exact
quote, policy applicability and numerical-copy checks run before saving. These
checks narrow failure modes; they do not establish legal or factual correctness.

**What did testing uncover?**
The first live regression run over-flagged six benign examples. The prompt now
distinguishes concrete textual concerns from routine human-review reminders, and
the server excludes human-only and channel-inapplicable policies. Original
failures are retained. See VERIFICATION.md for final counts and the distinction
between the tuned regression set and separately authored holdout cases.

**How do you stop public AI usage from draining the account?**
The server atomically claims two attempts per workspace, one per minute, and at
most twenty global attempts for this demo. Each attempt conservatively reserves
$0.05, totaling at most $1 of application admission allowance. Output is capped at
3500 tokens, inputs are bounded, the model and endpoint are fixed, and retries are
manual. Failed attempts consume allowance. This does not control charges made
with the same key outside this application or a future provider price change.

**Where are credentials stored?**
The sponsored key is a server-only Vercel secret. Visitor OpenRouter credentials
are AES-GCM encrypted with workspace-bound authenticated data, expire after 24
hours, and never appear in client responses, URLs, exports or application logs.
Disconnect removes the stored credential; provider revocation is separate.

**Is this production compliant?**
No. It is a fictional review prototype with an illustrative checklist. Production
needs real identity and memberships, policy governance, retention, durable audit
controls, broader abuse protection, observability and evaluation on labeled
representative creative. An actual compliance reviewer must evaluate the final
placement and supporting offer documentation.

## If asked what you would build next

First validate the actual bottleneck with reviewers and measure the workflow.
Then add identity/memberships, normalized records, policy ownership and retention.
Add file/placement review and affiliate intake when evidence shows those are the
next constraints. Do not promise a large ingestion or agent system before that.
