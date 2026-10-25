# Architecture and decisions

```text
Browser (React / TypeScript)
  ├─ GET/POST /api/workspace ── D1 workspace state + append-only application events
  └─ POST /api/analyze ─────── fixed Gemini endpoint ── validated review result
         visitor key in request header only
```

## Why a workflow, rather than only a chat box

The outcome is reviewer throughput. A campaign needs creative, context, policy
findings, actionable feedback, version history, and an explicit human decision.
Keeping those connected removes context gathering and coordination work. The AI
feature performs the bounded review task inside that workflow.

## Data and concurrency

Each browser gets a random UUID in an HTTP-only, SameSite=Lax cookie (Secure over
HTTPS). The server uses that cookie to load only its demo workspace. The cookie is
a bearer capability, not a production user identity. Do not use real private data.

A D1 row holds one bounded demo workspace as JSON with a revision counter.
Updates use `WHERE id = ? AND revision = ?`; one of two stale concurrent writes
fails with HTTP 409. The client refreshes instead of overwriting newer work.
AI results use the same compare-and-swap check after inference, so a delayed result
cannot silently replace review activity that happened during the request.

This intentionally trades database normalization and independent record updates
for a small, auditable prototype. A production service should normalize campaigns,
versions, findings, memberships, and events; add pagination, retention, and quotas;
and scope optimistic locking to a campaign/version.

## Human decision rules

- Confirming an issue means it still needs correction; it does not clear approval.
- Dismissal requires a written reason and creates an event.
- Approval requires all findings to be dismissed or resolved by a new version,
  plus a separate human review attestation.
- A new version always starts `in_review` with fresh automated findings.
- Prior creative and decisions cannot be edited through the application API.
- The event record is append-only through application actions, not a cryptographic
  or independently immutable audit system. Reset replaces disposable demo data.

## AI boundary

The visitor supplies a Gemini key. It remains in React page memory and is sent in
a header to the same-origin analysis route. That route uses the key only in the
`x-goog-api-key` header to a fixed Google endpoint. No arbitrary upstream URL,
tools, retries, or provider credentials in URLs are supported. Application code
does not log or persist keys. Hosting/provider infrastructure still processes
requests; no broader claim about third-party retention is made.

The system prompt contains the applicable curated policy checklist. Creative and
campaign metadata are encoded as untrusted JSON data. The model returns structured
findings and a proposed revision. Zod validates fields and lengths. The server
rejects unknown/inapplicable policies and evidence that is not verbatim source
text. A simple numeric guard withholds rewrites that introduce unseen numbers;
this does not establish factual correctness or prevent all invented terms.
Deterministic checks remain alongside AI findings unless the same concern is
already represented. Model output is rendered as text, never injected as HTML.

Prompt instructions and validation reduce specific failure paths; they do not
make the model immune to prompt injection or establish legal correctness.
No model output can directly approve or publish a campaign.

## Deliberate exclusions

Production authentication/RBAC, email delivery, affiliate crawling, PDF/OCR, image
placement analysis, comprehensive legal coverage, multi-tenant administration,
encryption of saved campaign fields, and measured throughput outcomes.

## Hosting portability

The current runtime is Vinext (Next-compatible App Router) on Cloudflare Workers,
with D1 provisioned by Sites. It is not a drop-in Vercel deployment: moving to
Vercel would require standard Next.js scripts and a replacement database adapter.
Business rules, AI validation, and React components are independent of D1.
