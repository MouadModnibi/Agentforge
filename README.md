# AgentForge

A production-quality no-code/low-code web app to build, configure, test, and deploy modular AI agents powered by Google Gemini. Think a simplified Flowise/Langflow — but leaner, faster, and free to run locally.

---

## Features

- **Agent editor** — tabbed form with prompt, typed inputs, JSON output schema, resources, external APIs, custom JS tools, and versioning
- **Playground** — run agents interactively, see raw output, validation results, execution trace, and token metrics
- **Public run API** — `POST /api/agents/:id/run` with optional API key protection
- **Streaming-ready** — Gemini response streaming (text format)
- **Free-tier resilient** — exponential backoff on 429s, in-process RPM queue, clear quota error messages
- **Dark mode** — system default, toggle, FOUC-free
- **Command palette** — Cmd/Ctrl+K to navigate anywhere
- **Version history** — every save creates a snapshot; restore any version in one click
- **Security** — SSRF guard on all outbound calls, AES-256-GCM secret encryption, sandboxed custom code execution

---

## Quick start

### 1. Get a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **Get API key** → **Create API key**
3. Copy the key (starts with `AIza…`)

Free tier limits are approximately **15 RPM / 1 500 RPD** for Flash models. To raise limits, enable billing in your Google Cloud project — see [AI Studio pricing](https://ai.google.dev/pricing).

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...your_key_here

# Optional — defaults shown
GEMINI_DEFAULT_MODEL=gemini-2.0-flash
LLM_MAX_RPM=8
APP_SECRET=change-me-to-a-random-32-char-hex-string
```

Generate a secure `APP_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Seed starter agents (optional)

```bash
npm run db:seed
```

Creates three sample agents: Summarizer, Sentiment Classifier, Data Extractor.

---

## Architecture

```
agentforge/
├── app/
│   ├── page.tsx                     # Dashboard
│   ├── agents/new, [id]/edit        # Agent editor
│   ├── agents/[id]/playground       # Playground
│   └── api/
│       ├── agents/                  # CRUD, run, versions, resources, API key
│       ├── playground/run           # Playground execution (no auth)
│       ├── tools/test               # Custom tool sandbox test
│       └── openapi/import           # OpenAPI 3.x → ExternalApi[]
├── components/
│   ├── dashboard/                   # Table, empty state, import dialog
│   ├── editor/                      # Tabbed editor, version drawer, API key panel
│   │   └── tabs/                    # 8 tabs: General, Prompt, Input, Output,
│   │                                #   Resources, ExternalAPIs, CustomTool, Advanced
│   ├── playground/                  # InputForm, OutputPanel, TracePanel, MetricsPanel, RunHistory
│   ├── CommandPalette.tsx           # Cmd+K palette
│   └── ui/                          # shadcn components + ThemeToggle
└── lib/
    ├── db/                          # Drizzle schema, SQLite client, seed
    ├── repositories/                # agents.ts, runs.ts — data access layer
    ├── schemas/                     # Zod schemas (single source of truth)
    ├── runtime/
    │   ├── runAgent.ts              # Core agentic loop
    │   ├── buildPrompt.ts           # Prompt builder + variable interpolation
    │   ├── outputValidator.ts       # JSON schema validation + repair prompts
    │   ├── toolRegistry.ts          # ExternalApi → Vercel AI SDK tools
    │   ├── resourceInjector.ts      # Resources → labeled context blocks
    │   ├── llmQueue.ts              # Global RPM limiter
    │   └── withRateLimitHandling.ts # 429 retry + exponential backoff
    ├── providers/
    │   ├── google.ts                # @ai-sdk/google wrapper
    │   ├── models.ts                # Model list with capability flags
    │   └── index.ts                 # LLMProvider abstraction
    ├── sandbox/
    │   └── customToolRunner.ts      # ServerSandbox (isolated-vm), BrowserWorkerSandbox
    └── security/
        ├── ssrfGuard.ts             # DNS-based SSRF protection
        ├── secrets.ts               # AES-256-GCM encrypt/decrypt (server only)
        ├── secrets-client.ts        # Browser-safe secret helpers
        └── rateLimit.ts             # Token-bucket rate limiter
```

### Data model (SQLite via Drizzle ORM)

| Table | Purpose |
|---|---|
| `agents` | Agent configs, status, API key hash, run count |
| `agent_versions` | Snapshot on every save (restore any version) |
| `resources` | Uploaded context files (.json/.txt/.md/.csv, 1 MB each) |
| `runs` | Execution history with input, output, trace, usage |

### Agent runtime flow

```
Input → validate → buildPrompt → [tool loop, maxIterations] → validate output
  → [repair loop, repairRetries] → persist run → return { output, valid, trace, usage }
```

1. System prompt + `{{variable}}` interpolation
2. Resources injected as labeled code blocks
3. Output format instructions appended
4. Tools built from ExternalAPIs + optional custom JS tool
5. `generateText` with Vercel AI SDK (`maxSteps = maxIterations`)
6. If model doesn't support tools + JSON mode together: extra formatting pass
7. JSON schema validation; on failure → repair prompt → retry up to `repairRetries` times
8. Run persisted to `runs` table; `agents.runsCount` incremented

---

## Security

### Custom tool sandbox

User-supplied JavaScript never runs in the main Node.js process:

- **Browser (Playground/tool test panel)**: Web Worker created from a Blob URL. No DOM, no `require`, no `process`. Network via `fetch` (browser enforces same origin/CORS). 5 s hard timeout via inner `setTimeout` + outer `Worker.terminate()`.
- **Server (public API runs)**: `isolated-vm` with 32 MB memory cap, no `require`, no `process`, no filesystem. Network only through an injected `ctx.fetch` that passes every URL through the SSRF guard. If `isolated-vm` is not installed, custom tools are **disabled with a clear message** — we never fall back to unsafe execution.

Install server sandbox (optional, required for custom tools in API runs):

```bash
npm install isolated-vm
```

### SSRF guard

Every outbound HTTP call (external API tools, custom tool `ctx.fetch`) goes through `lib/security/ssrfGuard.ts`:

- Blocks non-HTTP/HTTPS schemes
- Blocks metadata endpoints by hostname (`169.254.169.254`, `metadata.google.internal`, `100.100.100.200`)
- Resolves DNS and blocks RFC1918 / loopback / link-local / ULA IPv6 ranges
- Re-validates redirect targets
- 10 s timeout + 1 MB response size limit

### Secret storage

External API header values marked as secrets are encrypted with AES-256-GCM using `APP_SECRET` before being written to the database. They are:

- Never logged or included in traces
- Excluded from agent JSON exports
- Masked in all API responses (`****`)
- Decrypted in-process only at tool execution time

### API key auth

Per-agent API keys (`af_…`) are hashed (SHA-256) before storage. The plaintext is shown exactly once on generation. Revoke at any time from the Advanced tab.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | — | Google AI Studio key |
| `GEMINI_DEFAULT_MODEL` | — | `gemini-2.0-flash` | Default model for new agents |
| `LLM_MAX_RPM` | — | `8` | Global in-process LLM request rate cap |
| `APP_SECRET` | ✅ prod | `default-dev-secret-…` | AES-256 key material for secret encryption |
| `NODE_ENV` | — | `development` | Set to `production` for prod builds |

---

## Available models

| Model | Context | Notes |
|---|---|---|
| `gemini-2.0-flash` | 1M tokens | Fast, recommended default |
| `gemini-2.0-flash-lite` | 1M tokens | Fastest, lightest |
| `gemini-1.5-flash` | 1M tokens | Balanced |
| `gemini-1.5-pro` | 2M tokens | Most capable |

Add models to `lib/providers/models.ts`. Set `supportsToolsWithStructuredOutput: true` when the model can handle function calling and JSON schema output in the same request (triggers a more efficient runtime path).

---

## Raising free-tier limits

The Gemini free tier allows roughly 15 RPM and 1 500 requests/day for Flash models. To raise these limits:

1. Open your project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable billing
3. Navigate to **APIs & Services → Generative Language API → Quotas**
4. Request a quota increase

AgentForge will respect the new limits automatically — `LLM_MAX_RPM` controls the in-process throttle.

---

## Running tests

```bash
npm test
```

Tests cover: `buildPrompt`, `outputValidator`, `withRateLimitHandling` (including simulated 429s), `ssrfGuard` (private IP blocking), `rateLimit` (token bucket), `sandbox` (SandboxError types), `runAgent` (happy path, repair loop, timeout, trace).

---

## Roadmap

- **RAG** — plug in a `RAGStrategy` (already stubbed in `resourceInjector.ts`) to chunk and retrieve from large documents instead of injecting them wholesale
- **Multi-agent chaining** — route outputs from one agent as inputs to another; visualise as a DAG
- **Visual flow builder** — drag-and-drop node canvas (React Flow or similar)
- **Auth / teams** — NextAuth.js with workspace-level agent access control
- **Postgres** — swap the repository layer (`/lib/repositories/*`) for a Postgres-backed implementation; schema migrations via `drizzle-kit`
- **Additional providers** — add `@ai-sdk/openai`, `@ai-sdk/anthropic` to `lib/providers/` with the same `LLMProvider` interface; expose a provider selector in the General tab
- **Streaming output** — real-time token streaming in the Playground for text/markdown agents
- **Evaluation suite** — run an agent against a dataset of inputs and score outputs
- **Webhooks** — fire a POST to a configured URL after each successful run
