# m4m UX contract

## Product context and evidence

Private workspaces for individual automation builders. Current UI locale: English; dates use the browser locale and timezone. No currency, billing or legal flows. Source: README.md, docs/api.md, lib/workflows/schema.ts and server ownership wrappers. Preserve the server's 404 response for another tenant's resource; do not disclose its existence. Accessibility target: WCAG 2.2 AA baseline, with browser keyboard and narrow-screen checks.

## Visual contract

See DESIGN.md. Runtime CSS is canonical; semantic HSL variables adapt to Tailwind v4. Dark is the supported theme. app/motion.css is retired; app/visual-effects.css owns the requested illustration/preview motion, with the existing MotionToggle and reduced-motion preference taking precedence. Illustration geometry is reserved before assets load. Decorative imagery does not announce workflow status. Preview motion runs on pointer or keyboard focus and is labelled separately from execution state.

## Canonical UI Map

| Capability     | Canonical owner                                        | Source of truth       | Allowed variants                                                                      | Verification                          |
| -------------- | ------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| Select/Listbox | components/ui/select.tsx                               | Radix + this contract | Authored for shared forms; existing native node enum selects accept OS popup geometry | Keyboard and opened popup             |
| Form           | Input, Textarea, SecretInput + existing Zod validators | Server API schemas    | Auth, credential dialog, agent editor, settings                                       | Invalid submit, correction, pending   |
| Scrollbar      | app/globals.css                                        | DESIGN.md             | Internal canvas panels; document scroll for forms                                     | Computed style and mobile             |
| Toast          | components/providers.tsx Sonner                        | This contract         | Success/error                                                                         | Status + persistent actionable errors |
| CRUD           | useWorkflows/useAgents + existing routes               | docs/api.md           | Create opens editor; edit stays; delete returns owning list                           | Existing integration tests + browser  |

## Flow ledger

| Operation           | Pending                                               | Success                                   | Failure recovery                                               |
| ------------------- | ----------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| New/import workflow | Disable repeated submit                               | Open created canvas                       | Keep dialog/form, show error                                   |
| Save graph          | Disable duplicate save                                | Stay, update revision, clear dirty state  | Preserve graph; conflict never overwrites newer server version |
| Activate            | Await server validation                               | Label pinned active revision              | Keep draft and errors visible                                  |
| Run workflow        | Queue, then poll existing execution                   | Keep canvas and show step history         | Retain error and explicit retry confirmation                   |
| Delete              | App-owned confirmation naming object and history loss | Refresh list and clamp page               | Keep object, show server error                                 |
| Save credential/key | Mask secret, disable duplicate submit                 | Clear submitted secret only after success | Retain form, persistent error                                  |
| Sign in             | Disable submit, stable width                          | Full navigation clears account caches     | Preserve email; text error, no password in logs/storage        |

## Dataset navigation and state

Workflow/agent APIs currently return full private lists. Keep backend unchanged; client pagination renders 12 records per page and clamps after filtering/deletion. Search/filter/sort state stays in memory for this redesign: workflow titles and search terms may be private, and no URL state contract exists. Record this intentional privacy-preserving exception rather than putting private search terms in browser history. Search filters local data synchronously; clearing refocuses the input. Loading/error/no-results/empty are distinct. No bulk selection.

## Navigation and overlays

Desktop sidebar; narrow navigation uses Radix Dialog with Escape, focus trap and restoration. Existing non-modal editor inspector remains a persistent tool panel. Dialog and AlertDialog primitives own modal semantics; never browser confirm/alert/prompt. Confirm deletion, full retry, version restore and key removal. No extra confirmation for ordinary saves. Agent/workflow unsaved-change guards remain intact. Dynamic document titles identify the current screen.

## Forms and async resilience

Workflow test input has Plain text and JSON modes. Text-only manual workflows default to Plain text; raw paragraphs, bullets and quotes become the text field without rewriting. Other workflows retain JSON for fields such as chatId/priority. The two drafts remain separate when switching. Invalid input is explained inline and focused before any workflow save or enqueue request.

Product forms use noValidate and app-owned validation, field labels, textual errors and first-invalid focus. Existing Zod schemas remain canonical for agent validation; credential/auth forms use existing API constraints. Password and secret controls mask by default with a reveal toggle. Textareas cannot be manually resized; long editors use sufficient height and internal scroll. Pending actions preserve geometry and values. Failures never imply a successful save. Queued executions are not automatically retried because external sends may duplicate.

Session expiry remains server-enforced; protected APIs never fall back to another account. Server data is authoritative. Read errors provide retry, save errors retain drafts. The worker is not started merely for visual QA. No real email sends or user workflow changes are required for design verification.

## Migration and verification

Text execution output: show readable text rather than JSON string escapes. The same WorkflowTextOutput owner in the final result and node inspector offers a local A4 PDF download. Edits are explicitly for the current PDF preview and never mutate the saved execution. Keep secret redaction intact; downloads containing [REDACTED] require correction first. Empty/oversized/unsupported text has actionable errors; structured JSON keeps its existing inspector. The PDF generation runs locally in the browser with no extra API/model request or uploaded document.

Deployment runtime: serverless mode labels execution as Cloud jobs rather than asking the user to start a permanent worker. Telegram and manual runs wake a bounded job; Gmail depends on authenticated scheduler requests. A recent scheduler tick indicates arrival only, not successful integration processing. Execution history remains authoritative; failed/interrupted runs still require explicit retry review. Worker mode retains its existing connected/offline guidance.

Scope: shared chrome/tokens, workflow collection/editor, agents collection/editor/playground, credentials, auth and settings. Keep routes/APIs unchanged. Existing global geometry stays where useful; new identity replaces motion layer and collection layout. Run typecheck, lint, test, build, designmd lint and strict premium audit. Browser evidence is recorded in docs/design-review.md, with desktop/mobile, sibling screens, keyboard, error/no-results and overlay checks. Existing tests/accounts.test.ts and workflowApi.test.ts prove data boundaries; visual checks do not replace them.
