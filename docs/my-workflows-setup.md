# Your Gmail and Telegram workflows

Created for your registered m4m account on 28 October 2026. All three are drafts. Existing workflows were left untouched. No messages were sent and no service credentials were changed.

## Gmail: start here

Open http://127.0.0.1:3000/workflows/3cd560bc-f346-4b06-98e2-9d919d3ba474

Flow: New Gmail email → Summarize & draft a reply → Keep email & suggested reply.

The trigger already selects **My Gmail assistant**. Your Gemini account key is present. Saved credential presence does not prove that the provider credentials or model quota still work.

1. Click **New Gmail email** on the canvas. In the right **Configure** panel, check **Credential** is **My Gmail assistant** and **Mailbox** is **INBOX**.
2. Click **Test** in the right tools panel. Replace the input with:

```json
{
  "from": "test@example.com",
  "subject": "Meeting question",
  "text": "Hi Mouad, could you confirm whether Friday at 3pm works for you?"
}
```

3. Start the worker from a second terminal in the project directory: `npm run worker`. The worker also processes already-active workflows, so review those before starting it.
4. Click **Run workflow**. Manual Test input uses the supplied sample; it does not fetch your inbox. Open **Executions**, select the latest run, and inspect **Keep email & suggested reply**. This flow does not send email or create Gmail drafts: suggested replies are stored in execution results.
5. To process real mail, **Save**, then switch the workflow to **Active**. Wait for the first successful mailbox poll to establish its baseline. Send a NEW email to your Gmail address after that poll. Leave the worker running; inspect the new execution. Avoid simultaneously activating another workflow monitoring the same inbox unless you want both to process new emails.

Connection settings live at http://127.0.0.1:3000/credentials. For a new Gmail credential use: Integration **Email (IMAP + SMTP)**; IMAP **imap.gmail.com**, port **993**; SMTP **smtp.gmail.com**, port **465**; username and optional sender = your full Gmail address; password = a Google app password, not your normal account password. App passwords require eligible Google account settings and 2-Step Verification. The current credential UI adds/deletes credentials; to replace a bad one, add a new credential and select it in the trigger.

## Telegram: create the bot connection

1. In Telegram open the official **@BotFather** bot, send `/newbot`, and follow its prompts. Keep the resulting bot token private.
2. In m4m open http://127.0.0.1:3000/credentials → **Add credential**.
3. Name: **My Telegram bot**. Integration: **Telegram**. Bot token: paste the token from BotFather. Webhook secret: use a new random string of letters/numbers/underscores/hyphens. PowerShell can generate one locally with `[guid]::NewGuid().ToString('N')`. Save the credential. Keep both secret values out of chat.
4. Open your new bot in Telegram and send `/start`, then `hello`. Bots need you to start the conversation before they can message you.
5. Obtain your private chat ID using your own bot's getUpdates response. In PowerShell, run this locally (the token is prompted securely, not written literally to command history):

```powershell
$botSecretInput = Read-Host 'Bot token' -AsSecureString
$botApiToken = (New-Object System.Net.NetworkCredential('', $botSecretInput)).Password
$botUpdates = Invoke-RestMethod -Uri ("https://api.telegram.org/bot{0}/getUpdates" -f $botApiToken)
$botUpdates.result | ForEach-Object { $_.message.chat } | Select-Object id, type, first_name
```

Use the **id** of your private chat. If no result appears, send another message and retry. getUpdates cannot be used while a webhook is registered; do not remove an existing bot's webhook blindly. A newly created bot avoids that conflict.

## Telegram connection test (no Gemini needed)

Open http://127.0.0.1:3000/workflows/2dd33d6d-8e78-4cf3-958d-33d19ca3f8b0

1. Click **Send test message** → right **Configure** → **Credential** = **My Telegram bot**. Save.
2. Right **Test** panel → input below. Replace YOUR_CHAT_ID with your private chat ID; keep it in quotes.

```json
{
  "chatId": "YOUR_CHAT_ID",
  "text": "Hello Mouad! Your m4m Telegram connection works."
}
```

3. With the worker running, click **Run workflow**. This sends exactly the supplied test text to that chat. Check Telegram and the execution result. Keep the workflow in draft; activation is unnecessary for manual tests.

## Telegram AI reply bot

Open http://127.0.0.1:3000/workflows/891c30c8-8c63-4152-b24a-3c4dd40f485f

1. Select **My Telegram bot** in BOTH **Incoming Telegram message** and **Reply to same chat**. Save.
2. Test manually with `{"chatId":"YOUR_CHAT_ID","text":"Give me three ideas for organizing my day."}`. With the worker running, **Run workflow** calls Gemini and sends the response to your private chat. The bot has no conversation memory in this flow.
3. Automatic incoming Telegram messages require a public HTTPS endpoint; Telegram cannot reach 127.0.0.1. Deploy the app or use an HTTPS tunnel, then activate this workflow and register its webhook. Use the same bot token and webhook secret you saved in the credential. The webhook path is `/api/workflow-hooks/891c30c8-8c63-4152-b24a-3c4dd40f485f`.
4. For registration, use the already-prompted `$botApiToken` above and this PowerShell snippet. It sets this bot's webhook destination, replacing any prior destination:

```powershell
$publicAppBase = Read-Host 'Public HTTPS app URL, without trailing slash'
$hookSecretInput = Read-Host 'Webhook secret saved in m4m' -AsSecureString
$hookSecretValue = (New-Object System.Net.NetworkCredential('', $hookSecretInput)).Password
Invoke-RestMethod -Method Post -Uri ("https://api.telegram.org/bot{0}/setWebhook" -f $botApiToken) -Body @{
  url = "$publicAppBase/api/workflow-hooks/891c30c8-8c63-4152-b24a-3c4dd40f485f"
  secret_token = $hookSecretValue
}
Remove-Variable botApiToken,botSecretInput,hookSecretValue,hookSecretInput
```

5. Send your bot a message. An active workflow, reachable HTTPS app, matching webhook secret and running worker are all required. On Vercel, the worker still needs a separate persistent host; the web deployment alone is not the worker.

## Troubleshooting

- Queued forever / Worker offline: start the worker with the same database/environment as the web app.
- Missing credential: select it in each applicable node, then Save. If changing an active flow, deactivate/reactivate to pin the new saved revision.
- Gemini errors: Account settings → Gemini key; inspect the exact provider error and model/quota availability. AI usage follows your provider account limits.
- Telegram chat not found: send `/start` to the correct bot and use that bot's private chat ID.
- Gmail authentication failure: check the account/app password and IMAP access policy.

Sources: https://developers.google.com/workspace/gmail/imap/imap-smtp ; https://support.google.com/accounts/answer/185833 ; https://core.telegram.org/bots/features ; https://core.telegram.org/bots/api .
