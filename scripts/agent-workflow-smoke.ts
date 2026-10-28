import { loadEnvConfig } from "@next/env";
import { smokeCookie } from './smoke-auth';
import { GraphSchema, type WorkflowRun } from "../lib/workflows/schema";
loadEnvConfig(process.cwd());
const base = process.env.BASE_URL ?? "http://localhost:3000";
const headers = {
  "content-type": "application/json",
  cookie: '',
};
async function call(path: string, method = "GET", body?: unknown) {
  const r = await fetch(new URL(path, base), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok)
    throw new Error(`${r.status}: ${j.error?.message ?? "Request failed"}`);
  return j.data;
}
async function main() {
  headers.cookie = await smokeCookie(base);
  let agentId: string | undefined, workflowId: string | undefined;
  try {
    if (!(await call('/api/account')).hasGeminiKey)
      throw new Error("Save a Gemini key in the test account settings before the optional live AI test");
    const agent = await call("/api/agents", "POST", {
      name: `AI workflow validation ${Date.now()}`,
      config: {
        model: process.env.GEMINI_DEFAULT_MODEL ?? "gemini-3.8-flash",
        systemPrompt: "Reply with exactly AGENTFORGE_OK and nothing else.",
        outputFormat: "text",
        temperature: 0,
        maxTokens: 32,
        maxIterations: 1,
        repairRetries: 0,
        timeoutMs: 60000,
        inputParams: [],
      },
    });
    agentId = agent.id;
    const graph = GraphSchema.parse({
      nodes: [
        {
          id: "start",
          kind: "manual",
          label: "Start",
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: "agent",
          kind: "agent",
          label: "Existing agent runtime",
          position: { x: 300, y: 0 },
          config: { agentId, input: { text: "Validation" } },
          timeoutMs: 60000,
        },
      ],
      edges: [{ id: "s-a", source: "start", target: "agent" }],
    });
    const w = await call("/api/workflows", "POST", {
      name: "Live agent workflow validation",
      graph,
    });
    workflowId = w.id;
    const queued = await call(`/api/workflows/${workflowId}/run`, "POST", {
      input: { text: "Validation" },
    });
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const run = (await call(
        `/api/workflow-runs/${queued.id}`,
      )) as WorkflowRun;
      if (!["queued", "running"].includes(run.status)) {
        if (run.status !== "succeeded")
          throw new Error(run.error ?? "Live agent execution failed");
        if (!String(run.output).includes("AGENTFORGE_OK"))
          throw new Error("Unexpected live model output");
        const step = run.steps.find((s) => s.nodeId === "agent");
        console.log(
          JSON.stringify({
            status: "PASS",
            path: "Workflow -> existing agent runtime -> Google",
            usage: step?.usage,
          }),
        );
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Live AI test exceeded 90 seconds");
  } finally {
    if (workflowId) {
      try {
        const runs = (await call(
          `/api/workflows/${workflowId}/runs`,
        )) as WorkflowRun[];
        for (const run of runs.filter((r) =>
          ["queued", "running"].includes(r.status),
        ))
          await call(`/api/workflow-runs/${run.id}`, "POST", {
            action: "cancel",
          });
        await call(`/api/workflows/${workflowId}`, "DELETE");
      } catch {
        console.warn("Temporary AI workflow needs cleanup");
      }
    }
    if (agentId) await call(`/api/agents/${agentId}`, "DELETE");
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Live AI validation failed",
  );
  process.exitCode = 1;
});
