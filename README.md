# m8m

m8m builds reusable Gemini agents and connects them into visual automations. The workflow editor uses **React Flow (`@xyflow/react`)** with draggable nodes, connections, zoom, a minimap, configuration panels, and execution highlighting. A separate worker executes durable jobs; this is a working backend, not just a canvas.

For **free personal Vercel + Turso hosting**, follow [the serverless deployment guide](docs/free-deployment.md). Telegram runs on incoming messages; an authenticated external scheduler checks Gmail. A dedicated worker remains optional. Registration/login are required locally too. Only unclaimed legacy records need the operator claim command; already-owned accounts survive a database import with their existing login.

## Features

- Build agents with prompts, typed inputs, resources, API tools, custom JavaScript, output validation, playground, versions, and per-agent API keys.
- Create, import/export, duplicate, save, restore, activate, and run workflows. Reference previous outputs and inspect each step's input/output/error.
- Use 16 node types: manual/webhook/HTML form/Telegram/email/X triggers; existing agents/Gemini prompts; conditions/routers/transforms; HTTP/custom tools/Telegram/SMTP/X actions.
- Run asynchronously, view history, cancel supported operations, and explicitly retry failures. Active triggers use pinned versions; edits stay in drafts.
- Encrypt integration credentials, isolate accounts with password login, and optionally track execution metrics in MLflow.

Telegram, email (IMAP + SMTP), and X are the three initial integrations. They cover messaging, email, and social automation with real APIs. Gmail may use IMAP/SMTP app passwords where allowed; Gmail OAuth is not implemented. X needs appropriate provider access and permissions.

## Local setup

Use Node.js 24 LTS and npm. Native dependencies may require Python and a C++ build toolchain when no prebuilt binary exists. Docker includes that toolchain.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local`. Offline workflows need no API key; AI nodes need a Gemini key saved in **Account settings** and a model available to your Google project. Generate a stable `APP_SECRET` with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set APP_URL to the exact browser origin. Register at `/register` to create your private workspace. Start these in **two terminals**:

```powershell
npm run dev
```

```powershell
npm run worker
```

Open [Workflows](http://localhost:3000/workflows), click **Try working example**, then **Run workflow**. `priority: "high"` takes the urgent branch; other values take the standard branch. Runs remain queued when the worker is stopped. Original agents are at `/`; credentials are at `/credentials`.

Optional starter agents: set `SEED_EMAIL` to your registered account, then run `npm run db:seed`. Importable templates are in [examples/workflows](examples/workflows); regenerate with `npm run examples:export`.

The template picker also includes larger **Weather desk (24 nodes)**, **GitHub desk (20 nodes)** and **Support desk (18 nodes)** workflows. See [setup and scheduling instructions](docs/large-workflow-templates.md) for email credentials, city/repository settings and public forms.

## Environment

| Variable                                 | Purpose                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY`           | Legacy migration key only; users save private keys in Account settings |
| `GEMINI_DEFAULT_MODEL`                   | New agent model; example uses `gemini-3.8-flash`                       |
| `LLM_MAX_RPM`                            | AI requests/minute/process; default 8, configure for your quota        |
| `APP_SECRET`                             | Stable encryption/signing secret, minimum 32 characters in production  |
| `ALLOW_REGISTRATION`                     | Set false to close new registrations                                   |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Shared cloud database connection for Vercel and worker                 |
| `APP_URL`                                | Allowed browser origin; default `http://localhost:3000`                |
| `DATABASE_PATH`                          | SQLite path; default `data/agentforge.db`; web/worker must match       |
| `TRIGGER_POLL_MS`                        | IMAP/X polling interval; default 60000                                 |
| `WORKFLOW_TIMEOUT_MS`                    | Total run timeout; default 600000                                      |
| `MLFLOW_TRACKING_URI`, `MLFLOW_TOKEN`    | Optional tracking server and authentication                            |

Google documents the default model [here](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash). Availability and quotas depend on your project; check your provider dashboard.

## Integrations

Create credentials under **Credentials**; secret values are encrypted and never returned by the metadata API. Select the saved credential in each node.

- **Telegram:** save a bot token and a separate webhook secret, activate a Telegram trigger, and register the public HTTPS endpoint with Telegram using the saved credential's webhook secret as `secret_token`. Incoming `update_id` values deduplicate events.
- **Email:** save `user`, `password`, SMTP host/port (465 or 587), IMAP host/port (993), optional `from`. TLS is required. The first poll establishes a baseline; subsequent messages trigger jobs. Messages over 1 MB are skipped. Your provider may require an app password.
- **X:** save an OAuth user `accessToken` with read/write permissions plus `userId` for mentions. The first poll establishes a baseline. Provider access/credits are supplied by you; polling may cost money.
- **HTTP:** store private headers in HTTP credentials instead of graph JSON.

Agent nodes reuse existing resources, tools, validation and traces. Custom-tool nodes execute the selected agent's code in isolated V8 with memory/time bounds and no network, filesystem or Node APIs. Use HTTP nodes for networking. If optional `isolated-vm` fails to install, custom tools fail clearly while other nodes remain available.

See [API examples](docs/api-examples.md) for webhook registration and execution commands.

## Docker and production

```powershell
Copy-Item .env.docker.example .env.docker
# Edit APP_SECRET, APP_URL and provider settings.
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f worker
```

Web and worker run as non-root processes with a shared persistent volume and health checks. Development dependencies are pruned from the runtime image. Compose binds locally; `HOST_PORT` controls the port and `APP_URL` must match. Use a TLS reverse proxy for public hosting/Telegram. Production requires HTTPS and account login and per-agent keys on the public agent run API.

Optional MLflow: set `MLFLOW_TRACKING_URI=http://mlflow:5000` and start with `docker compose --env-file .env.docker --profile tracking up -d`. Only IDs, revision, duration, node counts and token metrics are sent. Tracking failure does not fail workflows. Pin the tracking image version/digest for production repeatability.

Without Docker: `npm run build`, then `npm start` and `npm run worker` under a supervisor using the same environment/database.

Back up the database **with APP_SECRET**. Use SQLite's backup API, or stop both processes before copying the database/WAL. Changing the secret prevents decryption. Network-mounted/multi-host SQLite is unsupported; use one host and one trigger-polling worker.

## Validation and delivery

```powershell
npm test
npm run typecheck
npm run lint
npm run build
# With web and worker running; set BASE_URL, SMOKE_EMAIL and SMOKE_PASSWORD for a registered test account:
npm run smoke
# Optional: one short live Google call using your configured key:
npm run smoke:ai
# Against containers, reads URL/password from your ignored .env.docker:
npm run smoke:docker
```

The smoke test creates and removes temporary workflows, checking both branches, persistence, webhooks, deduplication and the live worker without contacting integration providers or spending AI credits.

- [Architecture](docs/architecture.md)
- [Frontend design and layout](docs/frontend.md)
- [API reference](docs/api.md), [OpenAPI](docs/openapi.json), [API examples](docs/api-examples.md)
- [Test matrix](docs/test-matrix.md), [validation report](docs/validation.md)

## Limits and troubleshooting

Graphs have one trigger, no cycles, up to 100 nodes/300 edges. Joins receive active incoming outputs keyed by node ID. Retry restarts the saved graph and may repeat external effects; cancellation cannot recall delivered messages. Expired worker leases become interrupted instead of automatically replaying. These semantics have automated tests.

This initial automation platform is not full n8n parity. Teams/RBAC, OAuth linking, loops, scheduled triggers, streaming AI output, distributed queues and vector RAG remain future work. The existing JSON validator supports a subset of JSON Schema. The architecture document describes those boundaries.

For "Cannot connect to API", verify the server's Google key/model access, DNS, network/proxy/firewall settings and provider status. For queued workflows start the worker and check `/api/health` for `workerOnline: true`. For silent polling triggers inspect the trigger-status API and saved credentials.

## Delivery pack

See [requirement audit and handover](docs/delivery-checklist.md), [26-case acceptance grid](docs/acceptance-grid.csv), [data dictionary](docs/data-dictionary.md), and [service architecture](docs/service-architecture.md). New HTML form and mailbox-contact draft templates are available in the template picker.
