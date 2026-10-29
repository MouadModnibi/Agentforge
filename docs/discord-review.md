# Discord integration verification - 29 October 2026

- Adds an outbound Discord action and encrypted Discord webhook credential.
  Existing routes, shared credential dialog, SecretInput, native integration
  selector, node inspector, validation and workflow create/save flows are reused.
  DESIGN.md tokens and identity are unchanged; UX-CONTRACT.md records behavior.
- Adds a manual connection test and a 24-node weather-to-Discord template.
  Credentials remain unselected; creation never activates or sends a message.
- Only HTTPS Discord webhook paths are accepted. URL/query/host spoofing is
  rejected by client/server/runtime validation. Network requests retain the SSRF
  guard. URLs and token fragments are covered by execution redaction.
- `wait=true` requires Discord to return message/channel IDs. Only those IDs are
  exposed as action output. Provider bodies and network URLs are not exposed in
  errors. Mentions and automatic send retries are disabled. Blank/oversized
  messages and malformed thread IDs fail before accessing credentials.
- Tests: **207 passed / 23 suites**. Includes unsafe URL rejection, encrypted
  save and metadata-only listing, credential type filtering, redaction, payload
  construction, rate-limit/network errors, missing provider confirmation,
  retry restrictions and the complete weather-to-Discord graph with stubs.
- Typecheck and production build passed. Lint has zero errors and 17 existing
  warnings. Importable examples and the 47-operation OpenAPI document
  were regenerated with the additional node/credential enum values.
- Browser: isolated synthetic QA database on port 3001; no worker. Desktop
  1280x720 and mobile 390x844 credential forms fit without horizontal clipping.
  Invalid URL submission retained the field and focused its inline error. A
  dummy nonfunctional webhook was saved locally and listed as Discord metadata.
  The Discord template opened, its credential selector offered that connection,
  selecting/saving cleared the missing-credential warning, and Test opened in
  Plain text mode. No execution was queued; no message or real credential was
  sent. The temporary viewport was reset and the QA server stopped.
- Raw strict audit: `discord-ui-audit.json`, exit 1, same 21 previously reviewed
  component-wrapper false positives (Radix-trigger/asChild Button wrappers and
  canonical nonresizable Textarea wrappers). No new finding category; this is
  not claimed as a clean strict audit.

Screenshots: [credential desktop](discord-credential-desktop.png),
[credential mobile](discord-credential-mobile.png),
[Discord action setup](discord-action-setup.png).

Live Discord delivery needs the owner's webhook and was not tested. This
integration posts channel messages; it does not listen to Discord conversations
or host a Gateway bot. Daily weather runs still require a configured scheduler.
