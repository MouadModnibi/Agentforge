# Vercel + Turso accounts deployment

For the entirely free personal setup, follow [Free deployment](free-deployment.md). It uses the new serverless runtime and an external Gmail scheduler. The dedicated-worker instructions below remain an optional alternative.

The Next.js website runs on Vercel. Turso stores accounts, hashed passwords, sessions, workflows, agents, encrypted credentials, and execution history. A separate continuously running Node.js worker polls email and processes queued workflows. Vercel alone does not run that worker. You can initially run it on your PC; automations stop when that process or PC stops.

## 1. Create your database

Create a Turso account at https://turso.tech and create a database. Copy its database URL and authentication token into your private environment settings. Do not paste tokens into chat or commit them. Check the current free-plan limits on Turso's pricing page; hosting the worker is a separate requirement.

## 2. Choose whether to move your existing data

For a fresh cloud workspace, skip this step. Registration will create empty private accounts.

To preserve the local workspace, stop the web app and worker, back up `data/agentforge.db` and its WAL (if present), and keep the existing `APP_SECRET`. Run `npm run db:migrate` locally with no Turso variables set. Use Turso's documented SQLite-file import procedure to create a new database from this migrated file. Import only into a new, empty database; do not overwrite an existing cloud database. Uploaded data includes saved email contents and encrypted credentials. Never rotate APP_SECRET during this move: existing credentials require the original value.

Follow [Turso's official import procedure](https://turso.tech/blog/migrating-and-importing-sqlite-to-turso-just-got-easier): set WAL mode and checkpoint the source file while the app is stopped, then run `turso db import path/to/database.db` with the Turso Cloud CLI. Keep your original backup intact. [Vercel explains why a local SQLite file is not persistent hosting](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

The migration labels existing records as an unclaimed legacy workspace. It never gives them to the first registrant. After registering your own account, point your local environment at the destination database and run:

```sh
npm run accounts:claim-legacy -- --email your-registered-email@example.com
```

This operator-only command assigns old workflows, agents, credentials and their histories to that account. If a legacy Google key is present in the operator environment, it is encrypted into that account only. Stop the worker while doing this. The command is safe to repeat.

## 3. Configure Vercel

Import this repository as a Next.js project with Node.js 24. Use `npm run build` and the default Next.js output settings. Add these environment variables to Production:

| Variable | Value |
| --- | --- |
| TURSO_DATABASE_URL | Database URL from Turso |
| TURSO_AUTH_TOKEN | Database authentication token |
| APP_SECRET | Stable random secret of at least 32 characters; preserve the original if migrating |
| APP_URL | Exact public HTTPS origin, such as https://your-app.vercel.app |
| ALLOW_REGISTRATION | true, or false after your intended users register |

Do not set DATABASE_PATH on Vercel. A writable local SQLite file cannot provide durable Vercel storage. Production session cookies require HTTPS. Use a separate test database for preview deployments instead of exposing the production database to previews. Set APP_URL to the actual deployment/custom-domain origin, then redeploy after changing settings.

Schema migrations run transactionally on first database access. You can run `npm run db:migrate` beforehand with the cloud environment loaded. Open `/register`, create your account, then open **Account** to save your own Gemini key. Every account starts with its own private workspace and model key.

## 4. Start the worker

On an always-on host supporting Docker, copy `.env.cloud.example` to `.env.cloud`, fill in the same Turso connection and APP_SECRET as Vercel, then run:

```sh
docker compose -f compose.cloud.yaml up --build -d
docker compose -f compose.cloud.yaml logs -f worker
```

Alternatively, use Node.js 24 with `npm ci` then `npm run worker`, with those variables supplied by the host. Never put a second independent local SQLite database behind the cloud worker. The database queue and trigger lock coordinate workers. Start with one worker.

## 5. Verify

Register two test accounts and confirm each sees only its own workflows and credentials. Run a manual offline workflow; it should finish instead of remaining queued. Add a Gemini key in Account settings before running AI nodes. For Gmail, recreate or claim your email credential, activate the workflow, and send a new message after the first polling baseline. Set webhook endpoints to the new HTTPS domain and preserve their secrets.

Accounts use scrypt password hashes and revocable, expiring HTTP-only cookie sessions. There is currently no email verification or password-reset email flow. Registration can be closed with ALLOW_REGISTRATION=false. Back up both the database and APP_SECRET securely. Public agent execution requires the specific agent's API key; a workspace password is no longer an API credential.

Vercel function limits still apply to synchronous playground/agent calls. Long workflow runs execute in the separate worker. Optional isolated-vm must install successfully for custom JavaScript tools; other nodes do not require it.
