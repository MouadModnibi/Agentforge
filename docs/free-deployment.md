# Free personal deployment: Vercel + Turso + cron-job.org

Vercel runs the website and short workflow jobs. Turso stores accounts, password hashes, workflows, encrypted credentials and execution history. Telegram wakes jobs directly; a scheduled request checks Gmail and drains queued jobs. Your PC can be off once cloud setup is verified. This is best-effort hosting within free allowances, without guaranteed uptime. Vercel Hobby is for personal/non-commercial use; AI and email provider limits apply separately.

## 1. Export your current workspace

Your account already owns your workflows locally. Import the database to keep the same login and credentials; do not register a replacement account or run the legacy claim command again.

For the FINAL cutover, stop the local app and worker to prevent writes after the snapshot, then run from the project folder:

```powershell
npm run db:export-cloud
```

It prints a NEW `data/exports/m4m-turso-<timestamp>.db` file. It uses SQLite online backup, checkpoints the snapshot and checks integrity. The original is untouched. Running executions become interrupted in the snapshot; review their completed actions before retrying. Queued executions remain queued and can run when cloud processing starts. Review pending work before enabling cloud automation. Later local writes are not copied automatically. Keep your original database as backup.

Preserve the **EXACT existing APP_SECRET from .env.local**. Copy it privately into Vercel's environment settings. A different value cannot decrypt existing credentials or the account model key. Never upload the database or environment files to GitHub, or paste secrets in chat. Old database exports do not contain your latest workflows.

## 2. Create the Turso database

1. Sign in at [Turso](https://app.turso.tech/).
2. Choose **Create Database → Upload SQLite File**. Select the SQLite/libSQL-compatible option if the dashboard offers both SQLite and a newer native Turso engine: this app uses `@libsql/client`. Upload the NEW snapshot, select a nearby location, and create a new database in your organization. Keep your original backup.
3. Open the database, copy its **database URL** (`libsql://...`) and create an **authentication token**. Keep them private.
4. If **group not found** appears, refresh and reselect your current organization/group. If it persists, follow Turso's current support/CLI instructions rather than guessing group names.

For a fresh empty workspace, choose New Database instead and register after deployment. Migrations run transactionally on first database access.

## 3. Configure Vercel

Push project CODE to your own GitHub repository, excluding `.env*`, `data/`, `.next/`, and `node_modules/`. Import the repository at [Vercel](https://vercel.com/new) as **Next.js**, Node.js **24**, build command `npm run build`, default output. Enable **Fluid compute** for the configured 300-second function limit.

Add these variables to **Production**:

| Variable | Value |
| --- | --- |
| TURSO_DATABASE_URL | Turso database URL |
| TURSO_AUTH_TOKEN | Turso database token |
| APP_SECRET | EXACT existing local value if importing |
| APP_URL | Exact stable HTTPS origin, e.g. https://m4m-yourname.vercel.app |
| WORKFLOW_RUNTIME | serverless |
| CRON_SECRET | Independent random secret of at least 32 characters |
| ALLOW_REGISTRATION | false for your imported personal account; true if you need registrations |

Generate CRON_SECRET privately with a password manager. Do not reuse APP_SECRET or the Telegram secret. Do not set DATABASE_PATH on Vercel. Use a separate database for previews and keep production secrets out of preview environments. Users add Gemini keys in **Account**; the imported account retains its encrypted key.

Deploy. Update APP_URL and redeploy if the stable hostname changes. Sign in with your EXISTING account and confirm your workflows and credentials appear. `/api/health` should show `status: ok` and `runtime: serverless`. `workerOnline: false` between requests is normal. Database health alone does not prove automation works.

## 4. Add the free Gmail scheduler

Create an account at [cron-job.org](https://cron-job.org/en/) and create ONE job:

| Setting | Value |
| --- | --- |
| Title | m8m Gmail checks |
| URL | https://YOUR-STABLE-DOMAIN/api/automation/tick |
| Schedule | Every 5 minutes |
| Request method (Advanced) | POST |
| Custom header name | Authorization |
| Custom header value | Bearer YOUR_CRON_SECRET |
| Body | Empty |

Enable failure notifications and click **Test run**. Expected response: HTTP **202**, `{"accepted":true}`. It acknowledges scheduling, not successful workflow completion. The response is immediate because cron-job.org closes requests after 30 seconds; Next's `after()` continues bounded processing on Vercel. Inspect actual results in m8m execution history and Vercel runtime logs. `/api/health` exposes `schedulerLastTick` and `schedulerHealthy` (arrival within 15 minutes). Recent arrival does not mean all integrations succeeded.

401 means an absent/wrong/short CRON_SECRET or header. 409 means WORKFLOW_RUNTIME is not serverless. A redirect/login page means deployment protection or the wrong URL is blocking access. Use the public production URL, not a protected preview. Never put the secret in the URL.

Activate your Gmail workflow. For a new mailbox, the first poll establishes a baseline; send a NEW email afterwards. Imported trigger state continues from its saved UID. Wait for the next scheduled check, then inspect execution history. Disable duplicate Gmail workflows if you only want one summary per message.

Vercel's free built-in cron only supports daily execution, so this setup uses the external scheduler. Each invocation polls for up to 60 seconds, then processes queued work within a roughly four-minute total budget. A database lock prevents overlapping polling; atomic claims prevent duplicate execution. Remaining queued jobs await later ticks. Failed/interrupted jobs require explicit review and retry because external actions may already have happened. This mode is for a small personal workspace, not many accounts or long-running agents.

## 5. Switch Telegram from the tunnel to Vercel

After verifying the imported cloud workspace, register your SAME bot with the stable HTTPS address. The operator script checks that the URL equals APP_URL and reads your saved bot token without printing it:

```powershell
$env:APP_URL = 'https://YOUR-STABLE-DOMAIN'
npx tsx scripts/connect-telegram-webhook.ts mouadmolol2@gmail.com https://YOUR-STABLE-DOMAIN
```

The script uses the existing Telegram AI workflow and bot credential, activates the workflow and replaces the bot's webhook URL. Telegram allows only one webhook per bot. Keep the local database until verification succeeds. The destination cloud database must contain the same workflow/credential/secret from the import. Updating a credential alone does not register a webhook.

Send your bot a Telegram message WITHOUT Execute. Confirm a cloud execution appears and a reply arrives. If nothing arrives, check webhook errors and Vercel logs. AI quota/model errors are separate from delivery errors.

## 6. Verify cloud operation

- Confirm your account, original workflows, credentials and account key survived import.
- Run an offline manual workflow and verify completion.
- Verify the scheduler test and one scheduled tick. Send a NEW Gmail message and confirm a successful cloud execution.
- Verify automatic Telegram replies at the stable Vercel URL.
- Stop your local app, worker and tunnel, then repeat the Telegram test. Cloud jobs use Turso; they must not rely on your local database.
- Monitor free allowances, execution failures, polling errors and scheduler notifications. Back up Turso and APP_SECRET securely.

Cold starts, outages, quota exhaustion, function deadlines and email/AI provider restrictions can interrupt service. Failed/interrupted jobs are not replayed automatically. Accounts currently have no email verification or password reset email flow. Optional custom JavaScript tools require isolated-vm to install successfully.

## Optional dedicated worker later

Set WORKFLOW_RUNTIME=worker on Vercel, disable the external scheduler and use an always-on host with the same Turso connection and APP_SECRET to run `npm run worker`. The existing Dockerfile and compose.cloud.yaml support that mode. A worker on your PC requires the PC to stay on. Never use a separate local database behind the cloud worker.

## Provider references

- [Vercel function limits](https://vercel.com/docs/functions/limitations)
- [Vercel cron usage](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [cron-job.org features](https://cron-job.org/en/) and [FAQ](https://cron-job.org/en/faq/)
- [Turso allowances](https://turso.tech/pricing)
