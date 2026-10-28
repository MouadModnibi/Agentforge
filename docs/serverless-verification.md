# Serverless runtime verification

2026-10-28: prepared the free personal Vercel/Turso runtime and deployment guide. No cloud deployment or production database import was performed.

- `npm test -- --reporter=dot`: 151 tests passed across 18 files. New tests cover scheduler authentication/disabled mode, immediate acknowledgment, owner-scoped specific claims, duplicate protection, shared polling locks, missed-callback queue recovery, and budget-expired polling. Runner integration tests use in-memory SQLite and offline graphs; no real Telegram/email/AI requests.
- `npm run typecheck`: passed.
- `npm run build`: passed; includes `/api/automation/tick` and bounded workflow routes.
- `npm run lint`: zero errors, 18 existing warnings.
- Formatter ran on changed TypeScript sources.
- Strict frontend audit: same 20 component-wrapper false positives documented in design-review.md, no new category. Existing design tokens and layout preserved; runtime status copy updated consistently in list/editor. Browser navigation reached the working sign-in screen; the current browser was signed out, so authenticated runtime labels were not exercised visually.

Still required after external account setup: import a fresh snapshot while local writes are stopped, configure production secrets, deploy, test the cron-job.org request and scheduled tick, verify a new Gmail message and Telegram webhook at the stable HTTPS origin, then repeat with local services stopped. Free quotas, external service availability and finite function duration remain limitations. The scheduler's HTTP 202 is acceptance, not proof of completed automation.
