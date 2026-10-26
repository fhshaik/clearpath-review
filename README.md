# ClearPath Review

**AI-assisted marketing compliance, from first draft to a version-specific human decision.**

[Open the public demo](https://clearpath-review.vercel.app) ·
[Five-minute demo](docs/DEMO.md) · [Mental model](docs/MENTAL_MODEL.md) ·
[Verification evidence](docs/VERIFICATION.md)

ClearPath Financial is fictional. The prototype replaces fragmented Excel/email
coordination with one review workspace for personal loans, credit cards, mortgage
prequalification, and affiliate creative.

## Try it in five minutes

1. Open **A little breathing room / BrightMoney** using **Open sample review**.
2. Click **Run live AI review** before recording finding decisions. Inspect exact
   evidence, policy references, and the proposed correction.
3. **Request changes**, then **Open as Marketing draft**. Review/edit the draft and
   **Submit new version**.
4. Compare the exact old/new creative, then switch **Demo role → Compliance**.
5. Resolve remaining concerns, attest to human review, **Record approval**, and
   inspect/export the version-specific activity. Reload to see saved persistence.

The app opens without login. Each browser gets its own fictional saved workspace.
Role switching simulates colleagues; it is not production authentication. The
source repository is publicly available on GitHub.

## Real AI without visitor setup

Two sponsored Anthropic attempts per workspace are included while the demo's
global allowance remains. The review uses **Claude Haiku 5.5**. Creative is sent
to Anthropic only when the visitor clicks Run live AI review. The server claims
quota before inference: one attempt per minute, two per workspace, twenty globally
for this demo. Each attempted request conservatively reserves $0.05, totaling a
$1 application allowance. Failed attempts consume quota; reset does not replenish
it. There are no automatic retries. This is not a provider-account billing cap.

Visitors can optionally connect their own OpenRouter account through OAuth and
use GPT-4.1 Mini at their own expense. S256 PKCE and browser-bound state protect
the connection. Visitor credentials are encrypted server-side, expire after 24
hours, and never appear in browser JavaScript, exports, URLs, or application logs.
Disconnect deletes the stored connection; provider revocation is separate.

Initial reviews are curated **SAMPLE** examples. New versions get basic policy
checks and show **NOT RUN** until a real analysis completes. **LIVE AI** means a
provider response passed server validation and was saved. A failed call leaves
saved work unchanged. Sample mode remains useful when provider quota is exhausted.

## What the product handles

| Reviewer problem | Product behavior |
| --- | --- |
| Context scattered across email and spreadsheets | Searchable queue with product, channel, affiliate, priority and launch target |
| Vague feedback | Exact evidence, explanations, policy references and actionable change requests |
| Repeated drafting work | Editable suggested revisions; numerical/unfinished drafts withheld |
| Version confusion | Exact-text comparison and decisions attached to their original versions |
| Unsafe automatic approval | Server-enforced finding gates and separate human attestation |
| Lost work across tabs | Postgres persistence and optimistic concurrency with 409 conflict handling |
| Missing decision evidence | Activity history, JSON review record and formula-safe CSV queue export |

The model cannot approve, publish, send email, or execute tools. The illustrative
checklist is not exhaustive regulatory coverage. Text review cannot establish
visual disclosure placement, offer substantiation or linked-document correctness.
No measured throughput gain or real-world compliance accuracy is claimed.

## Architecture

React 19 and TypeScript provide the responsive UI; Next.js 16 App Router provides
server routes. Vercel hosts the app and Neon hosts Postgres. Pure domain rules
control state transitions. Parameterized SQL and revision-conditional updates
protect saved state. Providers return structured JSON; Zod, exact quotations,
policy applicability and draft guards validate it before persistence.

[Architecture](docs/ARCHITECTURE.md) explains the flow and storage tradeoffs.
[Design decisions](docs/DESIGN_DECISIONS.md) explains why the choices fit this scope.

## Run locally

Requires Node.js 22.13+, npm, Git, and a Postgres database accessible through Neon.
No provider key is required for the curated sample workflow.

```sh
npm ci
cp .env.example .env.local
# Configure DATABASE_URL and AI_CONNECTION_SECRET in the ignored local file.
npm run db:migrate
npm run dev
```

Open **http://localhost:5173**. For included real AI, explicitly configure your own
ANTHROPIC_API_KEY and set CLEARPATH_SPONSORED_AI=1 in the local server environment.
Keep all secrets off source control and out of NEXT_PUBLIC variables. Routine
local development should use a separate database from the hosted demonstration.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm start
# In another terminal:
node tests/http-smoke.mjs http://localhost:5173
node tests/http-workflow.mjs http://localhost:5173
```

Unit and ordinary HTTP tests do not make paid model calls. Explicit opt-in live
commands, concurrent quota checks, test-case definitions, and limitations are in
[TESTING.md](docs/TESTING.md). The dated evidence report distinguishes unit,
local/server, public/browser, real provider, and unverified OAuth-grant boundaries.
All observed failures are retained in the evaluation history rather than erased.

## Deploy and operate

Create a Vercel Next.js project and a Neon database. Set DATABASE_URL and
AI_CONNECTION_SECRET as server-only secrets. Sponsored mode additionally needs
the enable flag and ANTHROPIC_API_KEY as a production secret. The build applies
only idempotent schema creation/initialization; budget initialization never resets
existing counters. Configure preview secrets separately if needed.

The current release uses explicit source upload through Vercel's authenticated
API. **GitHub pushes are not automatic deployments** until the owner connects the
repository in Vercel. [OPERATIONS.md](docs/OPERATIONS.md) covers secret
scope, deployment checks, the sponsored kill switch, and troubleshooting.

## Source map

| Path | Responsibility |
| --- | --- |
| app/review-app.tsx, app/globals.css | UI, responsive views, accessible dialogs |
| app/api/workspace/route.ts | Validated workflow actions and persistence |
| app/api/analyze/route.ts | Review gates, provider selection, conditional save |
| app/api/ai/status/route.ts, lib/sponsored.ts | Included allowance status and atomic claims |
| lib/domain.ts | Policies, fixtures, state transitions and approval rules |
| lib/ai.ts | Shared prompt, provider transports and output validation |
| lib/oauth.ts, lib/connection.ts, app/api/auth/openrouter/ | Visitor OAuth, encryption, expiry and disconnect |
| lib/server.ts, db/, scripts/migrate.mjs | Sessions, input bounds, SQL and schema |
| tests/, scripts/evaluate-ai.mts, scripts/check-quotas.mts | Offline, HTTP, live-model and concurrency evidence |
| docs/ | Demo, mental model, decisions, operations and verification |

## Production next steps

Validate the bottleneck with actual reviewers and measure handling time, time to
first review, revision count, and time to decision by product/channel. Add real
identity/memberships, normalized records, per-campaign locking, retention,
independent audit controls, broader abuse prevention and redacted observability.
Maintain policies through a named compliance owner and evaluate on representative
labeled creative. Extend to files/placement and affiliate intake when those become
the demonstrated constraints.
