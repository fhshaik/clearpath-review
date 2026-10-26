# ClearPath Review

A focused marketing-compliance workspace for a fictional consumer finance company.
It connects submissions, evidence-linked findings, proposed revisions, and human
approval decisions so reviewers spend less time reconstructing context from Excel
and email.

[Open the public demo](https://clearpath-review-fhshaik.zany-perch-1310.chatgpt.site)

The demo opens without login. The GitHub source repository remains private by
owner request; repository reviewers need a separate GitHub invitation. Each
browser gets an isolated fictional workspace. Role switching is a demo feature.

## Try it in two minutes

1. Open **A little breathing room / BrightMoney** from the review queue.
2. Inspect the highlighted approval claim, rate-disclosure concern, and partner disclosure.
3. Request changes, then open the suggested revision as a Marketing draft.
4. Submit version 2 and compare it with version 1.
5. Switch the demo role to Compliance and record a version-specific approval.

Initial analyses are **curated sample examples**, not live model results. New
submissions get basic deterministic policy checks. For real AI, click **Connect
AI → Continue with OpenRouter**, authorize your own account, then return to a
campaign and click **Run live AI review**. The review uses GPT-4.1 Mini through
OpenRouter. Usage is charged to the visitor's OpenRouter credits and key allowance;
there is no developer-funded AI key and no guarantee of free inference.

OpenRouter OAuth uses S256 PKCE and a random state bound to the demo session.
Authorization codes are exchanged on the server. The resulting user credential
is encrypted with AES-GCM under a hosting secret, bound to its workspace, and
never returned to browser JavaScript, source code, URLs, exports, or application
logs. Connection access expires after 24 hours. Disconnect deletes the stored
connection; the user can revoke the provider key itself through Manage access.
Expiry limits access; it does not promise immediate deletion of expired rows.

## What works

- Searchable/filterable queue across personal loans, credit cards, and mortgage prequalification.
- Structured intake with campaign, product, channel, affiliate, creative, and launch target.
- Optional live OpenRouter analysis against a small, referenced internal checklist.
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
Sites provisions hosting and the database. OpenRouter is called through its REST API
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
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config dist/server/wrangler.json --persist-to .wrangler/state
npm run dev
```

Open the URL printed by the dev server (normally `http://127.0.0.1:5173`). The migration
command applies pending local schema changes. Local data and hosted data are separate.

A production-build preview is available with `npm start` after building. It shares
the local D1 state. Nothing in these commands publishes a site or calls a model.

Live local OAuth also requires an ignored local Worker secret named
`AI_CONNECTION_SECRET` containing 32 cryptographically random bytes encoded as
64 hex characters. Configure it in the local Wrangler environment. Configure the
same key name as a secret in Sites for hosting; never commit a real value.
Sample mode remains available without that secret.

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
successful real-user OAuth grant or model connection**. Verify those separately
through the hosted Connect AI flow. HTTP checks also cover OAuth initiation,
session/state isolation, failed exchange/replay handling, and disconnect.

A separate local development smoke test on October 25, 2026 used Codex signed in
with ChatGPT and the same review instructions on one fictional campaign. Its four
findings and proposed revision passed the app's evidence, policy, and numerical
validation. This is one example, not an accuracy evaluation, and does not verify
the hosted OpenRouter transport. The deployed app does not use the developer's Codex
session or subscription.

## Project map

| Path | Purpose |
| --- | --- |
| `app/review-app.tsx`, `app/globals.css` | Product interface and responsive styling |
| `app/api/workspace/route.ts` | Validated workflow mutations |
| `app/api/analyze/route.ts` | Bounded AI review and optimistic save |
| `lib/domain.ts` | Policies, fictional fixtures, state transitions, approval rules |
| `lib/ai.ts` | Prompt, fixed provider request, and output validation |
| `lib/oauth.ts`, `lib/connection.ts`, `app/api/auth/openrouter/` | PKCE, state, encrypted credentials, connection status and disconnect |
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
