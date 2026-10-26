# Verification record — October 26, 2026

This records observed results, including failures. It is not a certification of
financial-marketing compliance or an accuracy claim on real campaigns.

## Release state

Public URL: https://clearpath-review.vercel.app  
Source repository: https://github.com/fhshaik/clearpath-review

The sponsored-AI release is locally tested; production deployment and hosted
verification are in progress. This section will be updated with the release ID.

## Application checks

| Check | Observed result |
| --- | --- |
| TypeScript | Passed |
| Unit tests | 66 passed, zero failures |
| Production webpack build | Passed, including idempotent database migration |
| Local anonymous HTTP smoke | 14 passed |
| Local full HTTP workflow with real Anthropic | 8 passed |
| Atomic database quota checks | 5 passed; zero inference calls; real budget unchanged |
| Delayed real AI versus concurrent human comment | Passed: AI save returns 409, human comment preserved |
| Desktop browser workflow | Real AI → findings → request changes → Marketing edit → v2 comparison → Compliance attestation → approval → activity → reload passed |
| Mobile | 390×844 and 320×740: document width equals viewport; 320px submission dialog fits and scrolls |
| HTML-like creative | Submitted literal img/onerror text; rendered as plain text, zero image elements |
| Secret checks | Exact credential absent from source and browser static bundles; local environment ignored |

Both server-side workflow and database persistence were exercised. The browser
approval control stays disabled until the human attests; a version-specific
approval survives reload. The included provider path succeeded without an
OpenRouter account. Test fixtures use fictional content and isolated workspaces.

## Real AI evaluation history

| Run (UTC) | Suite | Result | Estimated USD |
| --- | --- | --- | --- |
| 07:54 | Initial regression | 8/14; six benign over-flags | 0.0116736 |
| 07:57 | Calibrated regression | 14/14 | 0.0089809 |
| 08:03 | Separate later-authored holdout | 5/6 | 0.0045494 |
| 08:09 | Usable-draft checks | 2/3 | 0.0026539 |
| 08:14 | Clarified mortgage guidance, draft checks | 3/3 | 0.0027837 |
| 08:19 | Final regression | 14/14; six benign cases clean | 0.0088306 |

All runs use Claude Haiku 5.5 through the production provider function. Every
returned review in the final regression passed schema and evidence validation.
The holdout miss was an unnecessary request to clarify when an already-qualified
card introductory period starts. Its strict benign rubric counts this as a false
positive; it was not relabeled or tuned away. An earlier draft test missed the
mortgage CP-05 concern; the deterministic check retained that concern in the final
review. The prompt guidance was then clarified and that focused suite rerun.

The six evaluator runs total approximately **$0.03947** from returned usage.
Additional bounded end-to-end calls were made; a deliberately discarded response
in the concurrency test has no saved usage receipt. These are estimates rather
than an exact account charge or remaining balance. Every evaluator call reserved
$0.05 against its explicit run budget. No automatic retries were used.

Sanitized case-level results, request hashes, token usage and retained failures:
[evaluation evidence](evidence/ai-evaluation-2026-10-26.json). Raw local receipts
are ignored under outputs/ai-eval; credentials are never recorded there.

## Limits to discuss

- This is a small fictional checklist evaluation. No legal certification, real
  campaign accuracy, measured throughput improvement or universal injection
  resistance has been established.
- A real visitor OpenRouter OAuth grant remains untested. PKCE, state binding,
  expiry, cancellation, replay and mocked exchange contracts are tested.
- Anonymous demo roles are not production identity or role-based access control.
  Workspace state persists in Postgres; clearing cookies loses access to that desk.
- Sponsored AI is two lifetime attempts per workspace, one per minute, twenty
  lifetime attempts globally. Resetting demo data does not reset this allowance.
  This is an application cap, not a provider account spending control.
- This release uses source upload to Vercel. GitHub push runs CI but does not
  automatically publish a new Vercel version.

See [TESTING.md](TESTING.md) for reproduction and [MENTAL_MODEL.md](MENTAL_MODEL.md)
for the architecture walkthrough.
