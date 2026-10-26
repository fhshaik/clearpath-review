# Running and operating the demo

## Environment

| Variable | Required for | Storage |
| --- | --- | --- |
| DATABASE_URL | Saved workspaces and quotas | Server-only database credential |
| AI_CONNECTION_SECRET | Visitor OpenRouter encryption | 64 lowercase hex characters; server secret |
| CLEARPATH_SPONSORED_AI | Included AI switch | `1` enables; `0` disables |
| ANTHROPIC_API_KEY | Included Claude reviews | Server-only secret; never NEXT_PUBLIC |

Sample mode works without provider credentials. Saved workflow still requires
Postgres. The sponsored key is scoped to production in Vercel; preview deployments
need their own explicit configuration if live sponsored testing is desired.

The deployed project is `clearpath-review` and the stable production URL is
https://clearpath-review.vercel.app. The GitHub repository is public and can be inspected independently of the demo.

## Local start

```sh
npm ci
cp .env.example .env.local
# Configure your own database and server secrets in the ignored local file.
npm run db:migrate
npm run dev
```

Use `http://localhost:5173`, the canonical local origin. Standalone scripts do not
automatically load Next's environment file; use `node --env-file=.env.local`.
Use a separate development database for routine development. Test suites create
isolated workspace IDs; the quota concurrency suite uses separate test-budget IDs
and never resets or consumes the real global allowance.

## Deployment

The current release is uploaded through the authenticated Vercel deployment API.
Automatic GitHub deployment is not connected; a GitHub push alone is not a release.
A future owner can connect the repository through Vercel's Git integration.

Verify source commit, project, environment and secret scope. Run type checking,
unit tests and build. The build applies only idempotent CREATE/INSERT-IF-MISSING
schema operations. Deploy, verify public HTTP and browser flows, then hand out the
stable production alias. Keep rollback metadata for the previous ready release.
Never upload `.env.local`, `outputs/`, provider keys, browser state or test traces.

## Included AI limits and kill switch

The `demo-v1` budget row is lifetime-scoped. Twenty attempted requests maximum;
each browser workspace has two attempts maximum and a one-minute interval.
Counters are claimed in one SQL statement before provider contact. Reset demo
replaces creative data but does not reset quota counters. Server failures and
stale-result conflicts do not refund a claim or trigger retries.

To disable sponsored generation, set CLEARPATH_SPONSORED_AI to `0` in production
and redeploy. The curated workflow and visitor-funded OpenRouter remain usable.
Do not reset the budget row or increase constants without a new explicit spending
allowance. The $0.05 reservation is conservative at the checked model prices,
not a provider-enforced dollar cap. See the pricing source in TESTING.md.

## Visitor OpenRouter

The same-origin start route creates a ten-minute, browser-bound PKCE/state record.
The callback consumes state atomically before any exchange, including cancellation.
The server exchanges the code at a fixed provider endpoint and encrypts the result
with a 24-hour access lifetime. The visitor can disconnect here and revoke the key
in OpenRouter's key settings. An expired encrypted row may remain until replacement
or disconnect; no automated retention/deletion guarantee is claimed.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Workspace cannot load | DATABASE_URL, schema migration, database availability |
| Included AI absent | Enable flag, sponsored key, remaining global/session attempts |
| Included AI 429 | One-minute interval or exhausted allowance; use sample/OpenRouter |
| Provider 400/401/403 | Key validity, account credits, provider/model access; response body is intentionally hidden from the browser |
| 409 after a save | Another tab changed the workspace; inspect refreshed data |
| OAuth connection failed | Same browser/cookie, current origin, unexpired state, correct encryption secret |
| AI response rejected | Schema/evidence/policy/length checks failed; saved workspace is unchanged |
| GitHub check succeeds but site unchanged | This project currently needs an explicit Vercel deployment |

Keep diagnostics free of keys, auth headers, full provider errors and creative
bodies. Production should add redacted request IDs, aggregate error metrics,
alerting, per-account quotas and retention jobs.
