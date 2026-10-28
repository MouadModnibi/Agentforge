import { loadEnvConfig } from "@next/env";
import { smokeCookie } from './smoke-auth';
import { templates } from "../lib/workflows/templates";
import type { Workflow, WorkflowRun } from "../lib/workflows/schema";
loadEnvConfig(process.cwd());
const base = process.env.BASE_URL ?? "http://localhost:3000";
const headers = {
  "content-type": "application/json",
  cookie: '',
};
const created: string[] = [];
async function request<T>(
  path: string,
  method = "GET",
  value?: unknown,
  extra?: Record<string, string>,
): Promise<T> {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { ...headers, ...extra },
    body: value === undefined ? undefined : JSON.stringify(value),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      `${method} ${path}: ${response.status} ${result.error?.message ?? "failed"}`,
    );
  return result.data ?? result;
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function completed(id: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const run = await request<WorkflowRun>(`/api/workflow-runs/${id}`);
    if (!["queued", "running"].includes(run.status)) {
      check(run.status === "succeeded", `Run failed: ${run.error}`);
      return run;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Worker did not finish within 30 seconds");
}
async function main() {
  headers.cookie = await smokeCookie(base);
  try {
    const health = await request<{ workerOnline: boolean }>("/api/health");
    check(health.workerOnline, "Start the worker before smoke testing");
    {
      const denied = await fetch(new URL("/api/workflows", base));
      check(
        denied.status === 401,
        "Administration API accepted an unauthenticated request",
      );
      const foreign = await fetch(new URL("/api/workflows", base), {
        method: "POST",
        headers: { ...headers, origin: "https://foreign.example" },
        body: "{}",
      });
      check(
        foreign.status === 403,
        "Administration API accepted a foreign browser origin",
      );
    }
    if (process.env.SMOKE_TEST_SANDBOX === "1") {
      const tool = await request<{ result: { doubled: number } }>(
        "/api/tools/test",
        "POST",
        {
          code: "async function run(args) { return { doubled: await Promise.resolve(args.n * 2) }; }",
          args: { n: 4 },
          timeoutMs: 1000,
        },
      );
      check(
        tool.result.doubled === 8,
        "Native sandbox did not return its asynchronous result",
      );
    }
    const example = templates.find((t) => t.id === "routing")!;
    const workflow = await request<Workflow>("/api/workflows", "POST", {
      name: `Smoke ${Date.now()}`,
      description: "Temporary validation workflow",
      graph: example.graph,
    });
    created.push(workflow.id);
    for (const [priority, queue, skipped] of [
      ["high", "urgent", "normal"],
      ["low", "standard", "urgent"],
    ]) {
      const queued = await request<WorkflowRun>(
        `/api/workflows/${workflow.id}/run`,
        "POST",
        { input: { priority, text: "Smoke request" } },
      );
      const done = await completed(queued.id);
      check(
        (done.output as { queue: string }).queue === queue,
        `${priority} branch output mismatch`,
      );
      check(
        done.steps.find((s) => s.nodeId === skipped)?.status === "skipped",
        "Unselected branch executed",
      );
      const persisted = await request<WorkflowRun[]>(
        `/api/workflows/${workflow.id}/runs`,
      );
      check(
        persisted.some((r) => r.id === done.id && r.status === "succeeded"),
        "Execution not persisted",
      );
    }
    const hookGraph = structuredClone(example.graph);
    hookGraph.nodes[0].kind = "webhook";
    const hook = await request<Workflow>("/api/workflows", "POST", {
      name: `Hook smoke ${Date.now()}`,
      description: "Temporary webhook validation",
      graph: hookGraph,
    });
    created.push(hook.id);
    await request(`/api/workflows/${hook.id}/activate`, "POST", {
      active: true,
    });
    const { key } = await request<{ key: string }>(
      `/api/workflows/${hook.id}/webhook-key`,
      "POST",
    );
    const denied = await fetch(
      new URL(`/api/workflow-hooks/${hook.id}`, base),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    check(denied.status === 401, "Unsigned hook accepted");
    const event = { priority: "high", text: "Webhook smoke" },
      auth = {
        authorization: `Bearer ${key}`,
        "idempotency-key": "smoke-event",
      };
    const first = await request<{ runId: string }>(
        `/api/workflow-hooks/${hook.id}`,
        "POST",
        event,
        auth,
      ),
      second = await request<{ runId: string }>(
        `/api/workflow-hooks/${hook.id}`,
        "POST",
        event,
        auth,
      );
    check(
      first.runId === second.runId,
      "Duplicate webhook created another run",
    );
    await completed(first.runId);
    console.log(
      "PASS: live worker, both branches, persisted history, authenticated webhook and event deduplication.",
    );
  } finally {
    for (const id of created) {
      try {
        const runs = await request<WorkflowRun[]>(`/api/workflows/${id}/runs`);
        for (const run of runs.filter((r) =>
          ["queued", "running"].includes(r.status),
        ))
          await request(`/api/workflow-runs/${run.id}`, "POST", {
            action: "cancel",
          });
        await request(`/api/workflows/${id}`, "DELETE");
      } catch {
        console.warn(`Cleanup needed for smoke workflow ${id}`);
      }
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Smoke test failed");
  process.exitCode = 1;
});
