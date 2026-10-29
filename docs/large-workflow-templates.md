# Large workflow templates

Open **Workflows → Templates**. The largest templates appear first. Selecting one
creates an inactive draft in your account; credentials are never chosen for you.
The description under workflow **Settings** contains its setup notes.

| Template                                 | Nodes | What it does                                                                                                                  |
| ---------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------- |
| Weather desk - three-city email briefing |    24 | Fetch three forecasts; branch on home-city rain, wind and heat; merge advice; email one briefing.                             |
| GitHub desk - project health email       |    20 | Read repository metadata, languages and recent commits; check backlog and archive status; email the evidence.                 |
| Support desk - form, routing and email   |    18 | Receive a public form; choose billing, technical or general queue; check urgency; email the team with a customer reply draft. |

All three use existing HTTP, transform, condition/router and email nodes. They do
not require Gemini, a custom tool, or a new backend service. Branches converge
before results are referenced. Skipped branches are expected in execution history.
HTTP failures stop execution before the email; there is no fabricated fallback
forecast or automatic retry of external sends.

## First: add the email sender

1. Open **Credentials → Add credential → Email (IMAP + SMTP)**.
2. For Gmail, use `imap.gmail.com`, port `993`; `smtp.gmail.com`, port `465`;
   your full Gmail address as username; a Google app password as the password.
   Sender email is your Gmail address. The account must permit app passwords.
3. Save the credential. Never put the password in a workflow transform, URL or
   exported JSON file.
4. In the template canvas, select its **Send weather email**, **Send project
   briefing** or **Notify team** node. Select the saved Email credential in the
   right panel. Each sender uses one SMTP submission attempt.

## Weather desk: test once

1. Create **Weather desk - three-city email briefing**.
2. Select **Weather settings - edit me**. Edit its Values object:
   - `recipient`: your real destination email.
   - `homeName/homeLat/homeLon`, `secondName/secondLat/secondLon`,
     `thirdName/thirdLat/thirdLon`: city labels and numeric coordinates. Change
     both the label and coordinates together. Defaults are Marrakech,
     Casablanca and Rabat.
   - `rainThreshold`: percent (default 60); `windThreshold`: km/h (40);
     `heatThreshold`: degrees Celsius (32). Checks use **greater than**.
3. Select **Send weather email** and choose your Email credential.
4. Save, then **Run workflow** with JSON input `{}`. This sends one real email to
   the configured recipient. No activation is needed for a manual test.
5. Check **Executions** for all three API responses, the chosen advice paths and
   the SMTP response. Check the recipient's spam folder if needed. SMTP
   acceptance is not proof of inbox delivery.

The email contains each city's local forecast date, current temperature, daily
low/high, rain probability and maximum wind. Planning notes apply to the home
city only. Each provider request asks for one day, Celsius, km/h and automatic
local timezone. These are forecast thresholds, not official weather alerts.

Weather provider: [Open-Meteo forecast API](https://open-meteo.com/en/docs).
The email includes attribution to Open-Meteo under CC BY 4.0. Review the
provider's current usage terms before commercial or high-volume use.

## Make weather or GitHub email recurring

These templates use the existing **Webhook** trigger, which also supports a
manual Run workflow test. Activation alone does not create a schedule.

1. Save and **Activate** the configured workflow.
2. In workflow **Settings**, copy the webhook endpoint and generate a webhook key.
   Keep the key private; generating a replacement invalidates the previous key.
3. In your scheduler, create a daily HTTPS **POST** request to the full endpoint:
   `https://YOUR-APP/api/workflow-hooks/WORKFLOW_ID`.
4. Set `Content-Type: application/json`, `Authorization: Bearer YOUR_WEBHOOK_KEY`,
   and JSON body `{}`. Choose the desired time and timezone in the scheduler.
5. Where supported, set a unique `Idempotency-Key` per scheduled occurrence, for
   example `weather-2026-10-29`. Reusing it for the same occurrence deduplicates
   ingestion; a constant key would suppress future days. Do not retry failed
   executions blindly because an email may already have been submitted.

HTTP 202 acknowledges the queued run; execution history shows the actual result.
Vercel requires the existing `WORKFLOW_RUNTIME=serverless` setup; a self-hosted
worker installation requires its worker to be running. The application's global
automation tick polls supported inbox/X triggers; it does not schedule these
webhook templates. Your scheduler must call each workflow endpoint explicitly.

## GitHub project briefing

Edit **Repository settings - edit me**: `owner`, `repository`, `recipient`, and
`backlogThreshold`. Use plain GitHub owner/repository names (no URL). Select the
SMTP credential on **Send project briefing**. Run with `{}`.

Defaults target the public `vercel/next.js` repository. GitHub anonymous rate
limits apply. For a private repository, add an HTTP credential containing the
appropriate Authorization header and select it on **all three fetch nodes**.
Never store the token in public headers. A missing/empty repository, provider
rate limit or inaccessible commits endpoint fails the run before sending.
Language data is byte counts; recent commits are included as JSON records. Open
item counts include issues and pull requests. This is a briefing, not an uptime
monitor or a security assessment.

## Support desk

Edit **Team settings - edit me → teamInbox** and select the SMTP credential on
**Notify team**. Save and activate. Select **Receive a support request**, then
open its public form link. Fill and submit the form.

- Category `billing` routes to Billing; `technical` to Technical; anything else
  routes to General. Values are case-sensitive.
- Priority `urgent` chooses the urgent note; any other value chooses standard.
- Only the fixed team inbox receives email. The submitter's email is content,
  never the notification destination. The acknowledgment is a draft in the
  final execution result and internal notification; it is **not** auto-sent.
- The form's acknowledgment confirms receipt, not successful SMTP delivery.

Manual test input is available in `examples/workflows/inputs.json`.

## Validation

`tests/largeTemplates.test.ts` executes actual transform, condition and router
nodes with stubbed provider responses and SMTP. It covers every weather risk
combination, all support queues/priorities, GitHub branches, missing provider
fields and upstream failures. No live email or user credentials are used.
Importable graphs live in `examples/workflows/`; re-export with
`npm run examples:export` after changing a template.
