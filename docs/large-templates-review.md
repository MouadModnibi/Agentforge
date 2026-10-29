# Large template verification - 29 October 2026

## Scope and UI ownership

Existing WorkflowsPage, Radix Dialog and create route remain canonical. The
catalog displays actual graph node counts, short summaries and integration
requirements; setup notes persist in the description. No palette, typography,
shared control, activation or credential behavior changed. The dark routing-desk
identity in DESIGN.md remains intact. UX-CONTRACT.md records the template flow.

## Evidence

- `npm test`: 187 tests passed across 22 suites. The 22 new tests run actual
  transforms, conditions and routers with HTTP/SMTP stubs, covering all eight
  weather risk combinations, threshold boundaries, all support queues and
  priorities, GitHub checks, absent forecast fields and failed API requests.
- `npm run typecheck` and `npm run build`: passed.
- `npm run lint`: zero errors; 18 pre-existing warnings outside the new code.
- A live public Open-Meteo call for the default home-city coordinates returned
  the expected current/daily fields, daily array values and Africa/Casablanca
  timezone. It did not transmit account data or send email.
- Both complete Weather and GitHub graphs subsequently passed live-provider
  dry runs through the production HTTP executor. Only SMTP was replaced by a
  local preview: each graph produced exactly one complete email preview and
  succeeded. GitHub fetch nodes include the required User-Agent header.
- Browser: isolated synthetic QA account/database, production build on port
  3001, no worker. Template picker at 1280x720 and 390x844: names, summaries,
  counts and requirements wrap without horizontal clipping; dialog scrolls.
  Keyboard focus starts on the first template. Existing shared modal owns
  focus handling; credential popup opens and Escape dismisses it.
- Selecting Weather desk created an inactive 24-node / 30-connection draft and
  opened the existing editor. Fit canvas showed the three forecasts, three
  risk branches and converging email path. The email panel showed an unselected
  credential, a Manage credentials link and the correct validation message.
  Settings retained the full setup notes. No real account or credentials were
  modified, and no email was sent. Temporary viewport was reset.
- Strict premium audit ran with output in `large-templates-ui-audit.json`:
  the same 21 previously reviewed wrapper false positives as the delivery
  audit (Radix-trigger/asChild Button wrappers and shared nonresizable Textarea
  wrappers); no new finding. It exits 1 and is not reported as a clean audit.

Screenshots: [desktop picker](large-templates-desktop.png),
[mobile picker](large-templates-mobile.png),
[weather graph](weather-template-canvas.png).

## Limits

Live SMTP delivery and external scheduler operation were not tested. They require
the owner to select credentials, choose a real recipient and configure a
schedule. Template creation does not authorize or perform a test email. SMTP
acceptance and webhook HTTP 202 remain distinct from inbox delivery and workflow
success. GitHub network responses are stubbed in the automated tests and were
also checked by the separate live-provider dry run.
