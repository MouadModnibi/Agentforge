import { query, runMigrations } from "@/lib/db/client";
export async function runtimeStatus() {
  const runtime =
    process.env.WORKFLOW_RUNTIME === "serverless" ? "serverless" : "worker";
  if (runtime === "worker")
    return { runtime, schedulerLastTick: null, schedulerHealthy: false };
  await runMigrations();
  const [row] = await query(
    "SELECT heartbeat FROM workflow_worker_health WHERE id='scheduler:last-tick'",
  );
  const schedulerLastTick = row ? Number(row.heartbeat) : null;
  return {
    runtime,
    schedulerLastTick,
    schedulerHealthy:
      schedulerLastTick !== null && Date.now() - schedulerLastTick < 15 * 60000,
  };
}
