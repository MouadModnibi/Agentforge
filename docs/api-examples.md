# API examples

These commands use Bash/curl. On Windows use `curl.exe` and your shell's quoting, or run `npm run smoke` for an automatic offline validation. Set BASE to the app URL. Sign in with your own registered account; keep the cookie jar and login JSON private and delete them after use.

```bash
export BASE=http://localhost:3000
# Store {"email":"you@example.com","password":"your-password"} in private login.json.
curl -c cookies.txt "$BASE/api/auth" -H 'Content-Type: application/json' --data-binary @login.json
curl "$BASE/api/health"
curl "$BASE/api/workflows" -b cookies.txt
curl "$BASE/api/workflows" -b cookies.txt \
  -H 'Content-Type: application/json' --data-binary @examples/workflows/routing.json
```

Copy the returned workflow ID:

```bash
export WORKFLOW_ID='returned-id'
curl "$BASE/api/workflows/$WORKFLOW_ID/run" \
  -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"input":{"text":"Please help","priority":"high"}}'
export RUN_ID='returned-run-id'
curl "$BASE/api/workflow-runs/$RUN_ID" -b cookies.txt
curl "$BASE/api/workflow-runs/$RUN_ID" -b cookies.txt \
  -H 'Content-Type: application/json' -d '{"action":"cancel"}'
# Only failed/cancelled/interrupted runs can be retried:
curl "$BASE/api/workflow-runs/$RUN_ID" -b cookies.txt \
  -H 'Content-Type: application/json' -d '{"action":"retry","acknowledgeSideEffects":true}'
```

## Generic webhook

Create a workflow with a Webhook trigger. Activate it, generate a key, then use that key (not the administrator password) for events:

```bash
curl "$BASE/api/workflows/$WORKFLOW_ID/activate" -b cookies.txt \
  -H 'Content-Type: application/json' -d '{"active":true}'
curl "$BASE/api/workflows/$WORKFLOW_ID/webhook-key" -X POST -b cookies.txt
export WEBHOOK_KEY='returned-key'
curl "$BASE/api/workflow-hooks/$WORKFLOW_ID" -H "Authorization: Bearer $WEBHOOK_KEY" \
  -H 'Idempotency-Key: event-123' -H 'Content-Type: application/json' \
  -d '{"text":"Webhook request","priority":"high"}'
```

Repeating event-123 returns the same run. Saving drafts does not change the active revision. Deactivate and reactivate to pin a newer saved version.

## Telegram

Create a Telegram credential containing `botToken` and a random `webhookSecret` (letters/digits/underscores/hyphens, <=256 characters). Import the Telegram template, select that credential and an existing agent, save and activate. Register your publicly reachable HTTPS endpoint using the credential secret:

```bash
export BOT_TOKEN='your-bot-token'
export WEBHOOK_SECRET='your-credential-webhook-secret'
export PUBLIC_BASE=https://your-agentforge-domain.example
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  --data-urlencode "url=$PUBLIC_BASE/api/workflow-hooks/$WORKFLOW_ID" \
  --data-urlencode "secret_token=$WEBHOOK_SECRET"
```

This command changes the bot's webhook destination. Send a message to your bot to test delivery. Check provider registration and workflow history. No webhook-registration API call is made automatically by m4m.

## Credentials and agents

```bash
curl "$BASE/api/workflow-credentials" -b cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"name":"Private API","kind":"http","values":{"Authorization":"Bearer provider-token"}}'
# Read metadata; secret values are not returned:
curl "$BASE/api/workflow-credentials" -b cookies.txt
export AGENT_ID='your-agent-id'
curl "$BASE/api/agents/$AGENT_ID/apikey" -X POST -b cookies.txt
export AGENT_KEY='returned-agent-key'
curl "$BASE/api/agents/$AGENT_ID/run" -H "Authorization: Bearer $AGENT_KEY" \
  -H 'Content-Type: application/json' -d '{"input":{"text":"Summarize this text"}}'
```

The agent run returns output/valid/trace/usage directly. Check `valid`, since HTTP success is not equivalent to output validation success. Refer to [the full API reference](api.md) for remaining administration/resource/tool APIs.
