import { writeFileSync } from "node:fs";
import { z } from "zod";
import {
  WorkflowInputSchema,
  CredentialInputSchema,
  GraphSchema,
} from "../lib/workflows/schema";
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  AgentConfigSchema,
} from "../lib/schemas/agent";
type Schema = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties: Schema = {}, required: string[] = []) => ({
  type: "object",
  properties,
  required,
});
const string = { type: "string" },
  integer = { type: "integer" },
  boolean = { type: "boolean" },
  free = { type: "object", additionalProperties: true };
const data = (schema: Schema) => object({ data: schema }, ["data"]);
const array = (schema: Schema) => ({ type: "array", items: schema });
const json = (schema: Schema) => ({ "application/json": { schema } });
const paths: Record<string, Record<string, unknown>> = {};
const schemas: Record<string, Schema> = {
  WorkflowInput: z.toJSONSchema(WorkflowInputSchema, { io: "input" }),
  Graph: z.toJSONSchema(GraphSchema, { io: "input" }),
  CredentialInput: z.toJSONSchema(CredentialInputSchema, { io: "input" }),
  CreateAgent: z.toJSONSchema(CreateAgentSchema, { io: "input" }),
  UpdateAgent: z.toJSONSchema(UpdateAgentSchema, { io: "input" }),
  AgentConfig: z.toJSONSchema(AgentConfigSchema, { io: "input" }),
  Error: object(
    {
      error: object({ code: string, message: string, details: {} }, [
        "message",
      ]),
    },
    ["error"],
  ),
  Success: object({ success: boolean }),
  Workflow: {
    allOf: [
      ref("WorkflowInput"),
      object({
        id: string,
        revision: integer,
        activeRevision: { type: ["integer", "null"] },
        createdAt: integer,
        updatedAt: integer,
      }),
    ],
  },
  NodeRun: object({
    nodeId: string,
    label: string,
    kind: string,
    status: {
      type: "string",
      enum: [
        "pending",
        "running",
        "succeeded",
        "failed",
        "skipped",
        "cancelled",
      ],
    },
    input: {},
    output: {},
    error: string,
    attempt: integer,
    startedAt: integer,
    finishedAt: integer,
    branch: string,
    usage: free,
  }),
  WorkflowRun: object({
    id: string,
    workflowId: string,
    revision: integer,
    graph: ref("Graph"),
    status: {
      type: "string",
      enum: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "cancelled",
        "interrupted",
      ],
    },
    source: string,
    input: free,
    steps: array(ref("NodeRun")),
    output: {},
    error: { type: ["string", "null"] },
    retryOf: { type: ["string", "null"] },
    cancelRequested: boolean,
    createdAt: integer,
    startedAt: { type: ["integer", "null"] },
    finishedAt: { type: ["integer", "null"] },
    leaseUntil: { type: ["integer", "null"] },
  }),
  CredentialSummary: object({
    id: string,
    name: string,
    kind: { type: "string", enum: ["telegram", "email", "x", "http"] },
    createdAt: integer,
  }),
  Agent: object({
    id: string,
    name: string,
    description: string,
    status: { type: "string", enum: ["draft", "active"] },
    config: ref("AgentConfig"),
    externalApis: array(free),
    customTool: {},
    apiKeyHash: {
      type: ["string", "null"],
      description: "Masked as configured; never the stored hash",
    },
    runsCount: integer,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  }),
  AgentResult: object({
    output: {},
    valid: boolean,
    trace: array(free),
    usage: free,
    llmRequestCount: integer,
    durationMs: integer,
    error: { type: ["string", "null"] },
  }),
};
function operation(
  method: string,
  path: string,
  summary: string,
  output: Schema = ref("Success"),
  body?: Schema,
  status = 200,
  security: unknown[] = [{ adminSession: [] }],
  wrapped = true,
  parameters: unknown[] = [],
) {
  paths[path] ??= {};
  const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: string,
  }));
  paths[path][method] = {
    summary,
    operationId: method + path.replace(/[^a-zA-Z0-9]/g, "_"),
    security,
    parameters: [...pathParams, ...parameters],
    ...(body ? { requestBody: { required: true, content: json(body) } } : {}),
    responses: {
      [status]: {
        description:
          status === 202
            ? "Execution queued"
            : status === 201
              ? "Created"
              : "Success",
        content: json(wrapped ? data(output) : output),
      },
      default: {
        description:
          "See docs/api.md for authentication, validation and execution error semantics",
        content: json(ref("Error")),
      },
    },
  };
}
operation(
  "post",
  "/api/auth",
  "Sign in",
  ref("Success"),
  object({ email: string, password: string }, ["email", "password"]),
  200,
  [],
);
operation('post','/api/auth/register','Register a private account',object({user:object({id:string,name:string,email:string})}),object({name:string,email:string,password:string},['name','email','password']),201,[]);
operation('get','/api/auth','Read current account',object({user:{type:['object','null']}}),undefined,200,[]);
operation('get','/api/account','Read private model-key availability',object({hasGeminiKey:boolean}));
operation('patch','/api/account','Save or clear your encrypted Gemini key',object({hasGeminiKey:boolean}),object({geminiKey:string},['geminiKey']));
operation(
  "delete",
  "/api/auth",
  "Sign out",
  ref("Success"),
  undefined,
  200,
  [],
);
operation(
  "get",
  "/api/health",
  "Check web and worker health",
  object({ status: string, workerOnline: boolean }),
  undefined,
  200,
  [],
  false,
);
operation(
  "get",
  "/api/workflows",
  "List workflows and worker status",
  object({ workflows: array(ref("Workflow")), workerOnline: boolean }),
);
operation(
  "post",
  "/api/workflows",
  "Create a workflow",
  ref("Workflow"),
  ref("WorkflowInput"),
  201,
);
operation("get", "/api/workflows/{id}", "Get workflow", ref("Workflow"));
operation(
  "patch",
  "/api/workflows/{id}",
  "Save draft with optimistic revision checking",
  ref("Workflow"),
  ref("WorkflowInput"),
);
operation(
  "delete",
  "/api/workflows/{id}",
  "Delete workflow without unfinished runs",
);
operation(
  "post",
  "/api/workflows/{id}/validate",
  "Validate graph and references",
  object({ errors: array(string) }),
);
operation(
  "post",
  "/api/workflows/{id}/activate",
  "Pin current revision or deactivate",
  ref("Workflow"),
  object({ active: boolean }, ["active"]),
);
operation(
  "post",
  "/api/workflows/{id}/run",
  "Queue manual execution of saved draft",
  ref("WorkflowRun"),
  object({ input: free }),
  202,
);
operation(
  "get",
  "/api/workflows/{id}/runs",
  "List 50 recent executions",
  array(ref("WorkflowRun")),
);
operation(
  "get",
  "/api/workflows/{id}/versions",
  "List immutable graph snapshots",
  array(object({ revision: integer, graph: ref("Graph"), createdAt: integer })),
);
operation(
  "post",
  "/api/workflows/{id}/restore",
  "Restore graph as a new draft revision",
  ref("Workflow"),
  object({ revision: integer }, ["revision"]),
);
operation(
  "post",
  "/api/workflows/{id}/duplicate",
  "Duplicate inactive workflow",
  ref("Workflow"),
  undefined,
  201,
);
operation(
  "post",
  "/api/workflows/{id}/webhook-key",
  "Rotate generic webhook key; shown once",
  object({ key: string }),
);
operation(
  "get",
  "/api/workflows/{id}/trigger-status",
  "Get polling cursor and last error",
  free,
);
operation(
  "get",
  "/api/workflow-runs/{id}",
  "Inspect execution snapshot and steps",
  ref("WorkflowRun"),
);
operation(
  "post",
  "/api/workflow-runs/{id}",
  "Cancel or retry saved graph; retry requires side effect acknowledgement",
  ref("WorkflowRun"),
  object(
    {
      action: { type: "string", enum: ["cancel", "retry"] },
      acknowledgeSideEffects: boolean,
    },
    ["action"],
  ),
);
operation(
  "get",
  "/api/workflow-credentials",
  "List credential metadata",
  array(ref("CredentialSummary")),
);
operation(
  "post",
  "/api/workflow-credentials",
  "Store encrypted integration credential",
  ref("CredentialSummary"),
  ref("CredentialInput"),
  201,
);
operation(
  "delete",
  "/api/workflow-credentials",
  "Delete unreferenced credential",
  ref("Success"),
  undefined,
  200,
  undefined,
  true,
  [{ name: "id", in: "query", required: true, schema: string }],
);
operation(
  "post",
  "/api/workflow-hooks/{id}",
  "Receive generic or Telegram event; active trigger required",
  object({ runId: string, status: string, ignored: boolean }),
  free,
  202,
  [{ workflowBearer: [] }, { telegramSecret: [] }],
  true,
  [{ name: "Idempotency-Key", in: "header", schema: string }],
);
operation(
  "get",
  "/api/agents",
  "List agents",
  array(ref("Agent")),
  undefined,
  200,
  undefined,
  true,
  [
    { name: "search", in: "query", schema: string },
    {
      name: "status",
      in: "query",
      schema: { type: "string", enum: ["draft", "active"] },
    },
  ],
);
operation(
  "post",
  "/api/agents",
  "Create agent",
  ref("Agent"),
  ref("CreateAgent"),
  201,
);
operation(
  "get",
  "/api/agents/{id}",
  "Get agent with masked secrets",
  ref("Agent"),
);
operation(
  "patch",
  "/api/agents/{id}",
  "Update agent",
  ref("Agent"),
  ref("UpdateAgent"),
);
operation("delete", "/api/agents/{id}", "Delete agent");
operation(
  "post",
  "/api/agents/{id}/duplicate",
  "Duplicate agent",
  ref("Agent"),
  undefined,
  201,
);
operation(
  "get",
  "/api/agents/{id}/versions",
  "Read masked snapshots",
  array(free),
);
operation(
  "get",
  "/api/agents/{id}/runs",
  "Read 50 recent agent executions",
  array(free),
);
operation(
  "post",
  "/api/agents/{id}/apikey",
  "Generate key, shown once",
  object({ apiKey: string }),
);
operation("delete", "/api/agents/{id}/apikey", "Revoke key");
operation(
  "get",
  "/api/agents/{id}/resources",
  "List resources with contents",
  array(free),
);
operation(
  "post",
  "/api/agents/{id}/resources",
  "Upload text resource <=1MB",
  object({ id: string }),
  undefined,
  201,
);
(
  paths["/api/agents/{id}/resources"].post as Record<string, unknown>
).requestBody = {
  required: true,
  content: {
    "multipart/form-data": {
      schema: object({ file: { type: "string", format: "binary" } }, ["file"]),
    },
  },
};
operation(
  "delete",
  "/api/agents/{id}/resources/{resourceId}",
  "Delete resource",
);
operation(
  "post",
  "/api/agents/{id}/run",
  "Synchronously execute agent; check valid in returned result",
  object({ output: {}, valid: boolean, trace: array(free), usage: free }),
  object({ input: free }, ["input"]),
  200,
  [{ agentBearer: [] }],
  false,
);
operation(
  "post",
  "/api/playground/run",
  "Execute agent in playground",
  { allOf: [ref("AgentResult"), object({ runId: string })] },
  object({ agentId: { type: "string", format: "uuid" }, input: free }, [
    "agentId",
    "input",
  ]),
);
operation(
  "post",
  "/api/tools/test",
  "Execute custom code in server sandbox",
  object({ result: {}, durationMs: integer }),
  object(
    {
      code: string,
      args: free,
      timeoutMs: { type: "integer", minimum: 100, maximum: 5000 },
    },
    ["code"],
  ),
);
operation(
  "post",
  "/api/openapi/import",
  "Import up to20 operations from OpenAPI3 JSON",
  object({ apis: array(free), title: string }),
  object({ spec: string }, ["spec"]),
);
const document = {
  openapi: "3.1.0",
  info: {
    title: "m4m API",
    version: "1.0.0",
    description:
      "Private user workspaces and asynchronous workflow execution. Detailed semantics in docs/api.md.",
  },
  servers: [{ url: "http://localhost:3000" }],
  paths,
  components: {
    schemas,
    securitySchemes: {
      adminSession: {
        type: "apiKey",
        in: "cookie",
        name: "m4m_session",
      },
      agentBearer: {
        type: "http",
        scheme: "bearer",
        description: "Per-agent af_ key",
      },
      workflowBearer: {
        type: "http",
        scheme: "bearer",
        description: "Generic workflow wf_ key",
      },
      telegramSecret: {
        type: "apiKey",
        in: "header",
        name: "X-Telegram-Bot-Api-Secret-Token",
        description: "Credential webhookSecret",
      },
    },
  },
};
writeFileSync("docs/openapi.json", JSON.stringify(document, null, 2) + "\n");
console.log(
  `Documented ${Object.values(paths).reduce((n, p) => n + Object.keys(p).length, 0)} API operations.`,
);
