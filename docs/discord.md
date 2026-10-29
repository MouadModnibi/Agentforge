# Connect Discord and run your workflows

Use [the online app](https://m4m-wheat.vercel.app/workflows). Refresh after the
deployment if Discord is missing from the node library.

## Send your first Discord message

1. In a Discord server you manage, open **Server settings → Integrations →
   Webhooks → New webhook**. You need permission to manage webhooks.
2. Choose the **text channel** that should receive messages, then **Copy webhook
   URL**. Keep this URL private: it contains the posting token.
3. In m8m: **Credentials → Add credential**. Name it `My Discord channel`, choose
   **Discord channel webhook**, paste the URL into **Discord webhook URL**, save.
   This field is masked and the saved URL is encrypted.
4. Open **Workflows → Templates → Discord - send a test message**.
5. Select **Post to Discord** on the canvas. In the right panel choose
   `My Discord channel` under **Credential**. Leave Thread ID empty for a normal
   text channel. **Save**.
6. **Run workflow → Plain text**: enter `Hello from m8m!`, execute, then check the
   chosen Discord channel and execution result. Activation is not needed here.

This integration **posts channel messages**. It does not read chats, start runs
when someone types, or host an interactive bot.

## Weather to Discord (24 nodes)

1. Create **Weather desk - three-city Discord briefing** from Templates.
2. Select **Weather settings - edit me**. Edit **Output data**: city names,
   latitude/longitude and thresholds. Defaults are Marrakech, Casablanca, Rabat.
3. Select **Post weather to Discord → Credential → My Discord channel**.
4. **Save → Run workflow** with JSON `{}`. No Gemini or weather key is needed.

For daily delivery, activate the configured workflow and schedule an authenticated
webhook call using the [large template guide](large-workflow-templates.md).
Activation alone does not create a schedule.

## Weather to email (24 nodes)

1. Save an **Email (IMAP + SMTP)** credential, or reuse your saved Gmail credential.
2. Create **Weather desk - three-city email briefing** from Templates.
3. In **Weather settings - edit me → Output data**, replace `you@example.com` in
   `recipient` with your email. Change city names and coordinates if desired.
4. In **Send weather email**, select your Email credential.
5. **Save → Run workflow** with `{}`. Check Executions and inbox/spam.

## GitHub and support templates

- **GitHub desk:** edit owner/repository/recipient in **Repository settings**,
  select Email credentials on **Send project briefing**, save, run with `{}`.
- **Support desk:** edit `teamInbox` in **Team settings**, choose Email credentials
  on **Notify team**, save and activate. Select **Receive a support request**,
  open its public form link and submit. The team inbox receives the notification;
  the customer acknowledgment remains a draft.

## Troubleshooting

| Problem                                | Correction                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `credentialId is required`             | Select a saved credential on every send node, then save.                                                                                    |
| Discord credential missing in selector | Save it as Discord channel webhook, not HTTP headers.                                                                                       |
| Discord HTTP 401/403/404               | Check that the webhook still exists and points to the correct channel. Recreate the credential if the webhook was replaced.                 |
| Discord HTTP 429                       | Wait for the rate limit to clear; check the channel before manually retrying.                                                               |
| Message too long                       | Shorten it to 2000 characters or less. No silent truncation or splitting occurs.                                                            |
| Forum/media channel needs a thread     | Use a regular text channel first, or enter an existing numeric Thread ID in the Discord node.                                               |
| Run stays queued                       | On Vercel check `WORKFLOW_RUNTIME=serverless` and logs; self-hosted worker mode needs a running worker.                                     |
| Daily message never starts             | Schedule POST requests to the active workflow endpoint with its generated key. The global polling tick does not schedule webhook templates. |

Discord sends use `wait=true` and require confirmed message/channel identifiers.
Mentions and automatic retries are disabled. Automated tests do not send messages.

Sources: [Discord webhook setup](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks),
[Execute Webhook API](https://docs.discord.com/developers/resources/webhook#execute-webhook).
