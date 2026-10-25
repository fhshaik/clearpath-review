# ClearPath Review

A focused marketing-compliance workspace for a fictional consumer finance company.
It connects submissions, evidence-linked findings, proposed revisions, and human
approval decisions so reviewers spend less time reconstructing context from Excel
and email.

[Open the private demo](https://clearpath-review-fhshaik.zany-perch-1310.chatgpt.site)

The deployed site and GitHub repository are private by owner request. Evaluators
need access granted before opening the links. The app itself uses demo roles;
the hosting access gate protects the private deployment.

## Try it in two minutes

1. Open **A little breathing room / BrightMoney** from the review queue.
2. Inspect the highlighted approval claim, rate-disclosure concern, and partner disclosure.
3. Request changes, then open the suggested revision as a Marketing draft.
4. Submit version 2 and compare it with version 1.
5. Switch the demo role to Compliance and record a version-specific approval.

Initial analyses are **curated sample examples**, not live model results. New
submissions get basic deterministic policy checks. To run real AI, use **Connect
AI**, add your own Gemini API key, and click **Run live AI review** on a version
awaiting review. Provider quotas, pricing, restrictions, and data-use terms apply.
The app does not require a developer-owned AI key.

The key stays in page memory. It is passed through the server to Google's fixed
endpoint only for a requested analysis, and is not stored in the database, browser
storage, URLs, exports, or application logs. Reloading removes it. Use fictional
creative in the public demo.

## What works

- Searchable/filterable queue across personal loans, credit cards, and mortgage prequalification.
- Structured intake with campaign, product, channel, affiliate, creative, and launch target.
- Optional live Gemini analysis against a small, referenced internal checklist.
- Evidence highlights, explanatory findings, and proposed revisions requiring human action.
- Confirm/dismiss finding dispositions; dismissals require a recorded reason.
- Requests for changes, fresh reviews for new versions, comparison, and preserved prior decisions.
- Human attestation before approval; the model cannot approve or publish.
- Server-persisted, separate anonymous demo workspaces with optimistic concurrency.
- Activity history, review-record JSON export, and formula-safe queue CSV export.
- Responsive layout, keyboard-accessible dialogs, reduced-motion support, and mobile navigation.

## Assumptions

The initial bottleneck is coordination and review effort, not simply the absence
of a chatbot. The prototype focuses on text creative and a complete review loop.
Policies are illustrative internal rules informed by linked CFPB, FTC, and eCFR
references; they are not a comprehensive legal compliance engine. No measured
throughput improvement is claimed.

Role switching simulates two colleagues in one isolated demo workspace. It is
**not production authentication or role-based authorization**. Each browser has
its own workspace; sharing the URL does not share its saved records. The current
cookie lasts seven days. Application events preserve review history through the
API but are not an independently immutable audit system.

## Stack

React 19, TypeScript, Radix dialogs, Lucide icons, and a Next-compatible App Router
on Vinext. Server routes run on Cloudflare Workers; Drizzle manages the D1 schema.
Sites provisions hosting and the database. Gemini is called through the REST API
with structured output and server-side validation.

Vinext is a beta framework. It is used here for the available Workers hosting path.
The application is not a drop-in Vercel deployment; moving would require standard
Next.js scripts and replacing the D1 adapter. Domain rules and AI validation are
independent of that adapter.

## Run locally

Requires Node.js 22.13 or later, npm, and Git. No AI key is needed to run the
sample workflow.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_new_maggott.sql
npm run dev
```

Open the URL printed by the dev server (normally `http://127.0.0.1:5173`). The SQL
command is the **first-time local database setup**; do not replay it after it has
succeeded. Local data and hosted data are separate.

A production-build preview is available with `npm start` after building. It shares
the local D1 state. Nothing in these commands publishes a site or calls a model.

## Verify

```sh
npm run typecheck
npm test
npm run build
# With the app running:
node tests/http-smoke.mjs http://127.0.0.1:5173
```

Unit tests cover approval gates, reasoned dismissals, preserved decisions across
revisions, unchanged state after rejected actions, product-scoped checks, evidence
validation, numerical rewrite guards, provider errors, key handling, CSV safety,
and exact-text comparison. HTTP smoke tests cover persistence, separate sessions,
stale-write rejection, origin checks, request limits, and missing-key behavior.
AI tests use a mock transport and **do not establish live model quality or a
successful real-key provider connection**. Verify that separately with your key.

## Project map

| Path | Purpose |
| --- | --- |
| `app/review-app.tsx`, `app/globals.css` | Product interface and responsive styling |
| `app/api/workspace/route.ts` | Validated workflow mutations |
| `app/api/analyze/route.ts` | Bounded AI review and optimistic save |
| `lib/domain.ts` | Policies, fictional fixtures, state transitions, approval rules |
| `lib/ai.ts` | Prompt, fixed provider request, and output validation |
| `lib/server.ts`, `db/`, `drizzle/` | Session isolation, persistence, concurrency, schema |
| `tests/` | Domain, AI-transport, and running-server verification |
| `docs/` | Architecture, tradeoffs, and presentation walkthrough |

The remaining `scripts/`, `worker/`, and connector helpers are the hosting starter's
runtime/build infrastructure. No external app connectors are used by this product.

## Next production steps

Add real identity and memberships, normalized storage and per-campaign locking,
server-side quotas/retention, observability without secrets, a maintained policy
approval process, and evaluation on labeled real-world examples. Extend to files
and placement review only after validating that those are the actual bottlenecks.
Measure handling time, time to first review, revision count, and time to decision
by product/channel before claiming a throughput gain.

See [architecture](docs/ARCHITECTURE.md) and the [five-minute demo](docs/DEMO.md).
