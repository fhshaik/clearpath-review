# Test strategy and reproduction

The goal is to verify a complete review story across browser, API, database and
provider boundaries, including rejected actions. A passing checklist is not a
legal-compliance evaluation or a guarantee of correctness.

## 1. Offline checks: safe to run in CI

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Unit tests use mock provider transports, never real keys. They cover human
approval rules, version preservation, reasoned dismissals, qualified claims,
affiliate disclosure checks, input schemas, streaming body bounds, cookies,
origin restrictions, CSV formulas, exact-text diffs, provider failures, output
validation, credential encryption, PKCE and OAuth exchange contracts.

The build can compile without a database outside Vercel. A Vercel build requires
DATABASE_URL and applies the idempotent schema. Compilation alone does not verify
a running database or provider.

## 2. Running-server HTTP suites

```sh
# Start the app separately with a configured database.
npm start
node tests/http-smoke.mjs http://localhost:5173
node tests/http-workflow.mjs http://localhost:5173
```

The smoke suite verifies isolated sessions, persistence, stale-write conflicts,
approval gates, origin controls, body limits and OAuth start/state/cancellation/
replay/disconnect behavior. It uses a deliberately invalid OAuth code, which
cannot authorize or charge a provider account.

The workflow suite creates a disposable workspace and completes a change request,
Marketing revision, comparison of saved versions, attestation-gated approval,
comment and fresh revision. It checks that invalid AI requests do not consume
included allowance and that reset does not replenish it.

Public verification uses the same suites against the Vercel URL, with no login
or protection-bypass credential.

## 3. Atomic quota checks: database required, no inference

```sh
node --env-file=.env.local --import tsx scripts/check-quotas.mts --database
```

This uses new test-only budget and workspace IDs. Ten concurrent claims on one
workspace admit one attempt. A second can start after the interval; a third is
rejected. Twenty concurrent claims at the last global slot admit exactly one.
The suite proves the real `demo-v1` allowance is unchanged. Tiny test rows remain
as isolated diagnostic fixtures; no existing records or real budgets are reset.

## 4. Real AI tests: explicitly opt in and budget

Configure your own ANTHROPIC_API_KEY in the ignored local environment. Never put
it in source, test fixtures, command arguments or CI logs.

```sh
# A real browser/API/database/provider path; consumes one included attempt.
node tests/http-workflow.mjs http://localhost:5173 --live

# One real request racing a human edit; the AI save must receive 409.
node tests/http-ai-race.mjs http://localhost:5173 --live

# Prompt/output regression tests call the same production provider function.
node --env-file=.env.local --import tsx scripts/evaluate-ai.mts --live --budget-usd=1
node --env-file=.env.local --import tsx scripts/evaluate-ai.mts --live --holdout --budget-usd=0.5
node --env-file=.env.local --import tsx scripts/evaluate-ai.mts --live --drafts --budget-usd=0.25
```

The live evaluator makes sequential calls without retries and durably records
admission before each one. Each call reserves $0.05 against the explicit run
budget; the script stops before another reservation would exceed that budget.
Inputs are bounded, output is capped at 3500 tokens, the model is fixed to
Claude Haiku 5.5, and no tools are available. Failure outcomes are retained.

Results and usage live under ignored `outputs/ai-eval/<timestamp>/`. Summaries
separate schema/evidence validity, expected-concern coverage and benign false
positives. The first 14-case run is retained alongside the calibrated rerun.
Six later-authored cases are a separate holdout; the prompt was not tuned to make
that holdout perfect. A focused three-case suite checks usable proposed drafts.

Cost estimates use returned tokens and the checked standard prices of $0.10 per
million input tokens and $0.50 per million output tokens for these short Haiku
5.5 requests. These are estimates, not account billing receipts. Source:
https://platform.claude.com/docs/en/models/haiku-5-5/overview
The reservation rate is deliberately much higher than typical observed costs.

## Browser verification

Manual browser verification covers the initial queue, filters and empty states,
real AI loading/results, evidence selection, request changes, editable draft,
version comparison, role switching, approval attestation, activity, reload and
export. Inspect desktop and narrow mobile layouts, dialog scrolling and keyboard
focus, browser console, and text rendering for HTML-like creative.

AI review must run before a reviewer records finding dispositions. A disposition
locks that analysis against replacement. The complete review is saved only if
the workspace revision still matches after inference.

## What the evidence does not establish

This is a small hand-authored fictional test set. It does not establish accuracy
on real campaigns, all prompt-injection robustness, regulatory certification,
visual disclosure correctness, accessibility conformance, load capacity or a
measured throughput gain. A successful sponsored Anthropic call also does not
establish a successful visitor OpenRouter OAuth grant. See VERIFICATION.md for
actual results, failures retained and remaining limits.
