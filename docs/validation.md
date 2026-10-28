# Delivery validation

Validated locally on Windows with Node.js 24 and in Linux Docker containers on 2026-10-01. This report distinguishes executed checks from provider-dependent setup instructions.

## Executed

- All **136 tests in 15 suites** pass, including original agents and new graph/engine/store/API/security/executor/polling/tracking coverage. Storage/API tests use in-memory SQLite rather than the user's database.
- TypeScript checks and the optimized Next.js production build pass. ESLint has no errors; existing unused-variable warnings remain.
- The browser created and executed the routing template. Both high/low branches produced the expected outputs, with the unselected branch skipped. Reload retained the saved graph and execution history. Node input/output, condition configuration and usage inspection were checked.
- `npm run smoke` passed against the running web/worker: both branches, persisted history, authenticated webhook, wrong-key rejection and duplicate-event deduplication. Temporary records were removed afterwards.
- `npm run smoke:ai` passed against the configured Google provider through a workflow's **existing AgentForge agent node**. The synthetic response was `AGENTFORGE_OK`; recorded usage was 17 prompt tokens, 5 completion tokens, 22 total. No user documents or private prompts were sent.
- The real isolated-vm sandbox returned asynchronous structured results, had no process/fetch APIs, terminated an infinite loop, and bounded a promise that never settled. Production `/api/tools/test` also returned the expected asynchronous result.
- Docker image compilation passed. Web and worker ran as healthy, non-root containers against their shared data volume, bound locally on port 3100 for validation. The Docker smoke test passed, including unauthenticated administration rejection and foreign-Origin mutation rejection.
- A completed workflow and its run survived recreation of both containers with the final production image. The persistence check removed its temporary records after verification. Fresh parallel builds also passed after correcting SQLite initialization to set its busy timeout before enabling WAL mode.
- Dependency inspection found a vulnerable transitive DOMPurify version in Monaco. It is pinned to patched 3.4.16. **`npm audit --omit=dev` reported zero production vulnerabilities.** The full development dependency audit retains four moderate findings associated with drizzle-kit/@esbuild-kit/old esbuild; npm's suggested force fix would downgrade/change drizzle-kit incompatibly. Development tooling is pruned from the runtime Docker image.

## Provider-dependent checks

Telegram payload/webhook authentication and sending, TLS SMTP sending, IMAP polling, and X posting/mention polling are covered with mocked provider responses. No live Telegram bot registration, SMTP delivery, mailbox account, or X account/credits were supplied or used. Configure your own credentials and perform these checks before publishing an externally connected automation.

MLflow REST behavior, sanitized metrics and outage isolation were tested with mocks. A live MLflow server/profile was not started. Public HTTPS/reverse-proxy routing and provider webhook reachability depend on your deployment and were not asserted by a localhost test.

## Scope and remaining constraints

This release implements the requested first workflow platform with three connector families; it does not reproduce all n8n functionality. It uses one administrator and a single-host SQLite queue, and recommends one polling worker. RBAC/teams, distributed trigger leadership, PostgreSQL, loops, schedule triggers, OAuth account linking, streaming output and vector retrieval remain separate work. An interrupted job is never automatically replayed; explicit retries can repeat external actions. Node/workflow timeouts cannot roll back actions already delivered.

Run the commands in README after changes. Use `npm run smoke:ai` only when you want a live provider request; unlike the offline smoke test, it consumes your account's API quota. Keep `.env.local`, `.env.docker`, database backups and APP_SECRET private.

## m8m requirements follow-up (2026-10-28)

165 tests passed across 21 suites; typecheck and production build passed. ESLint: 0 errors, 18 existing warnings. Generated OpenAPI contains 47 operations. New tests cover published form escaping, signed token scope/expiry/tamper, validation, inactive forms, origin rejection and duplicate submissions. The acceptance CSV contains 26 cases; live-provider and deployed-release acceptance remain explicitly marked NOT RUN. Branding retains legacy cookie and database identifiers to avoid logging out users or disconnecting data.

Browser acceptance of the generated form passed against an isolated QA database: GET rendered without login, missing required email produced inline error with message preserved, valid POST returned Request received/202. Desktop and 390x844 mobile views were inspected (m8m-form-desktop.png, m8m-form-mobile.png). Referrer-Policy same-origin preserves the Origin header for native HTML POST while cross-origin submission is rejected; see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy . No real workflow/credentials or external integrations were executed. Strict UI audit retains the 21 previously reviewed component-wrapper false positives; report m8m-delivery-ui-audit.json.
