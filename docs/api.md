# m8m HTTP API

Base URL: the running app, normally `http://localhost:3000`. All JSON requests use `Content-Type: application/json`. Success normally returns `{data: ...}`; errors return `{error:{code,message,details?}}`. The legacy public agent-run endpoint returns its result directly. Health is also an unwrapped object. See [OpenAPI](openapi.json) for machine-readable operations and [examples](api-examples.md).

## Authentication and errors

Workspace APIs require the m4m_session cookie issued after POST /api/auth with email and password. POST /api/auth/register accepts name, email and password (minimum 10 characters). Sessions expire after seven days and logout revokes them. Authentication is required in development too. Every resource is scoped to the signed-in owner. Browser mutations require matching Origin/APP_URL. Public agent runs require their specific agent key; workflow hooks retain their workflow/Telegram secrets. Health is public.

Common errors: 400 invalid JSON/schema/graph/reference, 401 missing or invalid authentication, 403 foreign browser origin, 404 missing entity, 409 stale revision or unsafe state transition, 413 workflow request over 1 MB, 429 rate limit, 500 unexpected failure, 503 missing provider/sandbox configuration. Tool execution additionally uses 408 timeout and 422 runtime failure. Workflow run status is separate from HTTP status: enqueuing succeeds with 202 and the job may later fail.

## Workspace, workflows and runs

| Method | Path | Request / response |
|---|---|---|
| POST | `/api/auth` | `{email,password}` -> `{data:{user}}`, HttpOnly session cookie |
| POST | `/api/auth/register` | `{name,email,password}` -> `{data:{user}}`, session cookie |
| GET | `/api/auth` | `{data:{user}}` or null user |
| GET / PATCH | `/api/account` | Read key availability / save `{geminiKey}` for current user |
| DELETE | `/api/auth` | Revoke session and clear cookie |
| GET | `/api/health` | `{status:"ok",workerOnline:boolean}` |
| GET | `/api/workflows` | `{data:{workflows:Workflow[],workerOnline:boolean}}` |
| POST | `/api/workflows` | WorkflowInput -> Workflow, 201 |
| GET | `/api/workflows/{id}` | Workflow |
| PATCH | `/api/workflows/{id}` | Full WorkflowInput with current `revision`; increments revision, stale saves 409 |
| DELETE | `/api/workflows/{id}` | `{success:true}`; refuses queued/running jobs |
| POST | `/api/workflows/{id}/validate` | No body -> `{errors:string[]}` including graph, agent and credential checks |
| POST | `/api/workflows/{id}/activate` | `{active:boolean}` -> Workflow; activation pins current validated revision |
| POST | `/api/workflows/{id}/run` | `{input:object}` -> WorkflowRun, 202; executes saved draft without requiring activation |
| GET | `/api/workflows/{id}/runs` | Up to 50 recent WorkflowRun records |
| GET | `/api/workflows/{id}/versions` | Immutable `{revision,graph,createdAt}[]` |
| POST | `/api/workflows/{id}/restore` | `{revision:number}` -> restored graph as new draft revision |
| POST | `/api/workflows/{id}/duplicate` | New inactive Workflow, 201 |
| POST | `/api/workflows/{id}/webhook-key` | `{key:string}` shown once, rotates prior key |
| GET | `/api/workflows/{id}/trigger-status` | Stored trigger cursor/error state or empty state |
| GET | `/api/workflow-runs/{id}` | WorkflowRun snapshot, steps, output/error, timestamps |
| POST | `/api/workflow-runs/{id}` | `{action:"cancel"}` or `{action:"retry",acknowledgeSideEffects:true}`; retry yields new run, 202 |
| GET | `/api/workflow-credentials` | `{id,name,kind,createdAt}[]`; never secret values |
| POST | `/api/workflow-credentials` | `{name,kind,values:Record<string,string>}` -> metadata, 201 |
| DELETE | `/api/workflow-credentials?id=...` | `{success:true}`; 409 while referenced by a draft/active version |
| POST | `/api/workflow-hooks/{id}` | Public provider/generic event -> `{runId}`, 202; requires active compatible trigger |

`WorkflowInput`: `{name,description?,graph:{nodes,edges},revision?}`. Names have 1–100 characters, descriptions <=1000. Nodes: `{id,kind,label,position:{x,y},config,retry?:{attempts:1..3,delayMs:100..30000},timeoutMs?:100..300000}`. Edges: `{id,source,target,sourceHandle?:"out"}`. IDs have no dots; exactly one trigger and an acyclic connected graph are required. Workflow response adds `id`, `revision`, `activeRevision`, `createdAt`, `updatedAt`. Draft saving permits incomplete configuration; run/activation require valid configuration.

`WorkflowRun`: `{id,workflowId,revision,graph,status,source,input,steps,output,error,retryOf,cancelRequested,createdAt,startedAt,finishedAt,leaseUntil}`. Status: queued, running, succeeded, failed, cancelled, interrupted. Steps: `{nodeId,label,kind,status,input?,output?,error?,attempt,startedAt?,finishedAt?,branch?,usage?}`. Step status additionally includes pending/skipped. Times are epoch milliseconds. History and full snapshots can contain user data; only the administrator can read them.

Generic hooks accept a JSON object and `Authorization: Bearer <workflow-key>`. Optional `Idempotency-Key` deduplicates repeated events within that workflow. Telegram uses `X-Telegram-Bot-Api-Secret-Token: <credential.webhookSecret>` and its original update payload; `update_id` deduplicates deliveries, message text/chatId become trigger data. Incorrect secret ->401; inactive/missing workflow ->404; incompatible trigger ->422. Hook requests are limited to 60/minute and 1 MB. Rotating a generic key revokes the old key. Telegram uses the separately supplied credential secret. IMAP/X use the background poller instead of this endpoint.

## Node configuration

| Kind | Required/configuration keys |
|---|---|
| manual, webhook | No fields |
| telegramTrigger | credentialId (Telegram) |
| emailTrigger | credentialId (email), mailbox defaults INBOX |
| xTrigger | credentialId (X; userId needed for polling) |
| agent | agentId, input object; reuses saved agent/resources/tools |
| gemini | model, prompt |
| condition | value, operator: equals/notEquals/contains/greaterThan/lessThan/exists, compare |
| router | value, cases object mapping handle names to values; fallback `default` |
| transform | values object |
| http | url, method GET/POST/PUT/PATCH/DELETE, headers object, body, optional credentialId |
| customTool | agentId (must have customTool), args object |
| telegram | credentialId, chatId reference/string, text |
| email | credentialId, to, subject, text |
| x | credentialId, text |

References: `{{input.text}}`, `{{trigger.text}}`, `{{nodes.agent.result}}`. An exact reference preserves its type; embedded references stringify. No eval or prototype access. Conditions output `true`/`false`, routers output case names/`default`; other kinds output `out`. Joins receive an object keyed by active incoming node IDs. Workflow output is the last executed node output. Do not embed secrets in config: use saved credentials.

Credential kinds/values: `telegram:{botToken,webhookSecret}`, `email:{user,password,smtpHost,smtpPort?,imapHost,imapPort?,from?}`, `x:{accessToken,userId}`, `http:{headerName:headerValue,...}`. Telegram webhookSecret contains 1–256 letters, digits, underscores or hyphens. SMTP/IMAP use TLS and public hosts.

## Existing agent APIs

These remain available and protected by admin authentication except the public run route.

| Method | Path | Contract |
|---|---|---|
| GET | `/api/agents?search=&status=draft\|active` | Filtered Agent[] |
| POST | `/api/agents` | CreateAgent -> Agent, 201; duplicate name ->409 |
| GET | `/api/agents/{id}` | Agent with encrypted headers/key hashes masked |
| PATCH | `/api/agents/{id}` | Partial agent updates; saving masked secret fields preserves prior encrypted values |
| DELETE | `/api/agents/{id}` | Delete agent and dependent agent records |
| POST | `/api/agents/{id}/duplicate` | Duplicate Agent, 201 |
| GET | `/api/agents/{id}/versions` | `{id,agentId,version,snapshot,createdAt}[]`; snapshot is a masked JSON string |
| GET | `/api/agents/{id}/runs` | Most recent 50 agent run records |
| POST | `/api/agents/{id}/apikey` | `{apiKey}` shown once; SHA-256 hash stored |
| DELETE | `/api/agents/{id}/apikey` | Revoke key |
| GET | `/api/agents/{id}/resources` | Resource[] including stored text |
| POST | `/api/agents/{id}/resources` | Multipart `file`, <=1 MB .json/.txt/.md/.csv -> `{id}`, 201 |
| DELETE | `/api/agents/{id}/resources/{resourceId}` | Delete resource |
| POST | `/api/agents/{id}/run` | Public: `{input:object}` with per-agent bearer key -> unwrapped `{output,valid,trace,usage}` |
| POST | `/api/playground/run` | `{agentId:uuid,input:object}` -> `{output,valid,trace,usage,llmRequestCount,durationMs,error,runId}` |
| POST | `/api/tools/test` | `{code,args?:object,timeoutMs?:100..5000}` -> `{result,durationMs}` from server sandbox |
| POST | `/api/openapi/import` | `{spec:string}` OpenAPI3 JSON -> `{apis,title}`; max20 operations; YAML unsupported |

Agent create/update schema is defined in `lib/schemas/agent.ts`: name, description, status, config (model, systemPrompt, temperature, maxTokens, inputParams, outputFormat, outputSchema, strictValidation, maxIterations, repairRetries, timeoutMs), externalApis and optional customTool. Typed input params support string/number/boolean/json/file plus required/default. Tool APIs use id/name/baseUrl/method/headers/queryTemplate/bodyTemplate/description/secretKeys. Resource uploads inject full text, not vector retrieval. Agent version restoration is a client-driven PATCH of the saved snapshot, not a distinct restore HTTP endpoint.

Agent execution is synchronous at the existing endpoint; workflow execution is asynchronous. A legacy agent response can have `valid:false` even with HTTP200, so check validity and trace. The playground response additionally includes its error. Provider configuration and quota errors are surfaced through execution results.

## Published HTML forms and scheduler

GET /api/workflow-forms/{id} renders only an active formTrigger with escaped labels and declared fields. POST accepts URL-encoded fields and the signed hidden token; checks origin, expiry/revision, field types and required values; maximum 32 KB. Repeated submission of the same form token enqueues only one event. HTTP 202 acknowledges submission, not execution success. Form activation is deliberate public publishing; submissions can trigger downstream actions. Do not publish private profile data or secrets.

POST /api/automation/tick requires Bearer CRON_SECRET and serverless runtime, returns 202 immediately and schedules bounded polling/queue processing. GET /api/health also reports runtime and last scheduler tick. A recent tick is not proof of successful integrations.
