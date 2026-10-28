# Test matrix

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Tests are independent of Gemini keys and production databases; workflow storage tests use in-memory SQLite. Live connector tests require user-supplied accounts and are separate from mocked tests.

| Area | Scenarios | Verification |
|---|---|---|
| Existing agents | Prompt building, JSON repair, quota backoff, traces, sandbox errors | Existing seven Vitest suites |
| Graph validation | Cycle, duplicate IDs, missing endpoints, disconnected nodes, trigger count, wrong handles, graph limits | workflowGraph tests |
| Bindings | Typed references, nested data, unresolved paths, prototype keys | workflowGraph tests |
| Execution | Selected IF branch only, input handoff, fail/skip propagation, progress updates | workflowEngine tests |
| Reliability | Timeout ignoring cancellation, cancellation before/during work, pure-node attempt limit, output-size cap | workflowEngine tests |
| Persistence | Version snapshots, stale save, pinned activation, queue claiming, expired lease, cancellation, retry lineage | workflowStore tests |
| Credentials | Encrypted at rest, metadata-only API, protected deletion, webhook-key rotation | workflowStore tests |
| Authentication | Production fail-closed, bearer, signed session, tampering, foreign origin | workflowSecurity tests |
| Payloads | Oversized streamed requests, valid JSON, secret redaction, typed agent inputs/defaults | workflowSecurity tests |
| CRUD API | Create/read/update/delete, stale save, malformed request, invalid activation | workflowApi tests |
| Webhook API | Inactive rejection, key rejection, accepted authenticated event, duplicate event IDs | workflowApi tests |
| Integrations | Telegram/HTTP payloads, email transport configuration, X errors | workflowExecutors tests |
| Polling | First-poll baselines, UIDVALIDITY, bounded email, X cursor and pagination, provider failures | workflowTriggers tests |
| Tracking | Disabled tracking, MLflow REST calls, sanitized metrics, outage isolation | workflowTracking tests |
| Browser | Create template, canvas fit, configure condition, manual run, inspect success/skip, reload | Manual browser verification |
| Production | Image builds, web/worker health, protected API, persistent execution | Docker smoke script / documented checks |

## Demo grid for a professor

1. Create “Route a support request” from the workflow templates.
2. Run with `{"text":"Please help","priority":"high"}`. Expect urgent branch succeeded and standard branch skipped.
3. Run with priority `low`. Expect the reverse branch selection.
4. Change and save a node. Show the new version; restore a previous snapshot.
5. Open the agent-powered template, choose an existing agent, and run after configuring Gemini credentials. Show agent tokens and node output.
6. Create a webhook trigger, generate a key, activate, and POST a sample payload. Show the queued execution and eventual completion.
7. Try a wrong webhook key and demonstrate 401. Disconnect a node and show validation prevents activation.
8. Stop the worker. Queue a run, restart the worker, and demonstrate durable pickup.
9. Show architecture/API documentation and Docker web/worker boundaries.

Do not claim a live provider was tested unless a real configured account was used. A successful offline branching demo validates the graph/queue/worker/UI path, not Gemini, SMTP delivery, X billing/access, or Telegram webhook registration.
