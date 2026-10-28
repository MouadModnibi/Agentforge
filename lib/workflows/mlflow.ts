import type { WorkflowRun } from "./schema";
/** Optional, metrics-only tracking. Prompts, credentials and execution payloads are never sent. */
export async function trackExecution(run: WorkflowRun) {
  const base = process.env.MLFLOW_TRACKING_URI;
  if (!base) return;
  try {
    if (!["http:", "https:"].includes(new URL(base).protocol)) return;
  } catch {
    return;
  }
  const request = async (path: string, body?: unknown) => {
    const response = await fetch(
      new URL(path, base.endsWith("/") ? base : base + "/"),
      {
        method: body ? "POST" : "GET",
        headers: {
          "content-type": "application/json",
          ...(process.env.MLFLOW_TOKEN
            ? { authorization: `Bearer ${process.env.MLFLOW_TOKEN}` }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error(`MLflow HTTP ${response.status}`);
    return response.json();
  };
  try {
    let experimentId: string;
    try {
      const data = await request(
        "api/2.0/mlflow/experiments/get-by-name?experiment_name=AgentForge",
      );
      experimentId = data.experiment.experiment_id;
    } catch {
      experimentId = (
        await request("api/2.0/mlflow/experiments/create", {
          name: "AgentForge",
        })
      ).experiment_id;
    }
    const data = await request("api/2.0/mlflow/runs/create", {
      experiment_id: experimentId,
      start_time: run.startedAt ?? run.createdAt,
      tags: [
        { key: "workflow_id", value: run.workflowId },
        { key: "execution_id", value: run.id },
        { key: "revision", value: String(run.revision) },
      ],
    });
    const id = data.run.info.run_id;
    const totals = run.steps.reduce(
      (a, s) => ({
        promptTokens: a.promptTokens + (s.usage?.promptTokens ?? 0),
        completionTokens: a.completionTokens + (s.usage?.completionTokens ?? 0),
      }),
      { promptTokens: 0, completionTokens: 0 },
    );
    const metrics = {
      duration_ms:
        (run.finishedAt ?? Date.now()) - (run.startedAt ?? run.createdAt),
      node_count: run.steps.length,
      ...totals,
    };
    await request("api/2.0/mlflow/runs/log-batch", {
      run_id: id,
      metrics: Object.entries(metrics).map(([key, value]) => ({
        key,
        value,
        timestamp: Date.now(),
        step: 0,
      })),
    });
    await request("api/2.0/mlflow/runs/update", {
      run_id: id,
      status:
        run.status === "succeeded"
          ? "FINISHED"
          : run.status === "cancelled"
            ? "KILLED"
            : "FAILED",
      end_time: run.finishedAt ?? Date.now(),
    });
  } catch {
    console.warn(
      JSON.stringify({ event: "mlflow.unavailable", executionId: run.id }),
    );
  }
}
