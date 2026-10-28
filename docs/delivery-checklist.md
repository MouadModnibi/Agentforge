# m8m delivery acceptance checklist

Checked against the user's brief on 2026-10-28. "26" is provisionally interpreted as 26 acceptance scenarios; "deactionair" as a data dictionary. These interpretations await confirmation.

| Requirement | Evidence / status |
|---|---|
| Three integrations/triggers | Telegram webhook, Gmail/IMAP polling, X mentions. Mocked connector tests exist; live credentials/permissions are required. X may require paid access. |
| Visual workflows like n8n | React Flow, DAG validation, branches, versions, activation and execution history implemented. |
| Mailbox/contact assistant | New draft-only template. Configure an approved business contact. Automatic sending awaits owner's contact/sending policy. |
| HTML form generator trigger | New formTrigger node and public HTML GET/signed POST, validated fields, duplicate-event protection. Save and activate to publish. |
| MLflow | Existing worker export plus new serverless export, metrics only. Requires a configured tracking server; live service acceptance not claimed. |
| API documentation | Regenerated docs/openapi.json: 47 operations; docs/api.md and api-examples.md. |
| README | Updated product identity, setup/deployment links, capabilities and known limits. |
| Data dictionary | docs/data-dictionary.md generated from actual schema metadata, no private row contents. |
| Test grid | docs/acceptance-grid.csv: 26 cases, expected results, evidence and honest live-test status. |
| Microservices | Separate web/worker/MLflow deployment exists. Shared database and modules: not fully independent bounded-context microservices; see service-architecture.md. |
| Company-style delivery | This checklist, architecture, API contract, test evidence and operator handover below. No enterprise SLA/certification claimed. |
| Rename to m8m | Visible brand, metadata, package and current docs updated. Legacy cookie/CSS/database paths and existing Vercel domain remain compatible. |

## Operator handover

1. Node 24, npm ci, private environment settings, stable APP_SECRET. Never commit data or keys.
2. Run npm test, typecheck, lint and build. Docker web/worker/optional tracking topology is compose.yaml. Vercel uses WORKFLOW_RUNTIME=serverless and an authenticated external scheduler.
3. Register users and configure private Gemini/integration credentials. Close registration if appropriate. No password reset/email verification flow is implemented.
4. Import workflows, select credentials, test and activate the saved revision. Activation publishes HTML form titles/fields to anyone with the link; do not include secrets.
5. Register stable Telegram webhooks (one per bot); verify new Gmail/X events after the polling baseline. HTTP 202 means accepted, not completed.
6. Set MLFLOW_TRACKING_URI/token in worker and Vercel as applicable. Existing experiment name AgentForge remains for history compatibility. Tracking outages must not fail workflows.
7. Complete live/manual entries in the grid before acceptance; never mark them passed based on mocks.
8. Back up database and APP_SECRET separately. db:export-cloud creates WAL-compatible snapshots. Preserve APP_SECRET across imports.
9. Roll back code using a known-good Vercel deployment. No new tables/destructive migration here; graphs using formTrigger require this release or later.
10. Monitor quotas, scheduler ticks, failed executions and integration errors. Free hosting has finite jobs and no 24/7 SLA; long jobs need an always-on worker. Keep MLflow behind an appropriate secured deployment.
