import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { workflowStore } = await import("../lib/workflows/store");
  const { query, execute, runMigrations } = await import("../lib/db/client");
  const { withOwner } = await import("../lib/security/owner");
  const { executeGraph } = await import("../lib/workflows/engine");
  const { pollTriggers } = await import("../lib/workflows/triggers");
  const { redact } = await import("../lib/workflows/service");
  const { trackExecution } = await import("../lib/workflows/mlflow");
  const { randomUUID } = await import("node:crypto");
  type Steps = import("../lib/workflows/schema").NodeRun[];
  await runMigrations();
  const workerId = randomUUID();
  let stopping = false,
    current: { id: string; ownerId: string } | undefined,
    controller: AbortController | undefined,
    polling = false,
    beating = false;
  const stop = () => {
    stopping = true;
    controller?.abort();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const heartbeat = setInterval(async () => {
    if (beating) return;
    beating = true;
    try {
      await workflowStore.heartbeat(workerId, current?.id);
      if (polling)
        await execute(
          "UPDATE worker_locks SET expires_at=? WHERE name=? AND holder=?",
          Date.now() + 60000,
          "triggers",
          workerId,
        );
      if (
        current &&
        (await withOwner(
          current.ownerId,
          async () =>
            (await workflowStore.getRun(current!.id))?.cancelRequested,
        ))
      )
        controller?.abort();
    } catch {
      console.error("Worker heartbeat failed");
      controller?.abort();
    } finally {
      beating = false;
    }
  }, 5000);
  let nextPoll = 0;
  console.log(JSON.stringify({ event: "worker.started", workerId }));
  try {
    while (!stopping) {
      await workflowStore.heartbeat(workerId);
      if (Date.now() > nextPoll) {
        const lock = await query(
          "INSERT INTO worker_locks(name,holder,expires_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET holder=excluded.holder,expires_at=excluded.expires_at WHERE worker_locks.expires_at<? RETURNING holder",
          "triggers",
          workerId,
          Date.now() + 60000,
          Date.now(),
        );
        if (lock.length) {
          polling = true;
          try {
            const owners = await query(
              "SELECT DISTINCT w.owner_id FROM workflows w JOIN users u ON u.id=w.owner_id WHERE w.active_revision IS NOT NULL AND u.password_hash IS NOT NULL",
            );
            for (const row of owners) {
              if (stopping) break;
              await withOwner(String(row.owner_id), () => pollTriggers());
            }
          } finally {
            polling = false;
            await execute(
              "DELETE FROM worker_locks WHERE name=? AND holder=?",
              "triggers",
              workerId,
            );
          }
        }
        nextPoll =
          Date.now() +
          Math.max(Number(process.env.TRIGGER_POLL_MS ?? 60000), 10000);
      }
      if (stopping) break;
      const run = await workflowStore.claim(workerId);
      if (!run) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      current = { id: run.id, ownerId: run.ownerId };
      controller = new AbortController();
      console.log(
        JSON.stringify({ event: "execution.started", executionId: run.id }),
      );
      await withOwner(run.ownerId, async () => {
        const result = await executeGraph(run.graph, run.input, {
          signal: AbortSignal.any([
            controller!.signal,
            AbortSignal.timeout(
              Math.max(1000, Number(process.env.WORKFLOW_TIMEOUT_MS ?? 600000)),
            ),
          ]),
          onProgress: async (steps) => {
            await workflowStore.progress(
              run.id,
              (await redact(steps)) as Steps,
            );
          },
        });
        await workflowStore.finish(
          run.id,
          result.status,
          (await redact(result.steps)) as Steps,
          await redact(result.output),
          result.error ? String(await redact(result.error)) : undefined,
        );
        await trackExecution((await workflowStore.getRun(run.id))!);
        console.log(
          JSON.stringify({
            event: "execution.finished",
            executionId: run.id,
            status: result.status,
          }),
        );
      });
      current = undefined;
      controller = undefined;
    }
  } finally {
    clearInterval(heartbeat);
    await execute("DELETE FROM workflow_worker_health WHERE id=?", workerId);
  }
}
main().catch(() => {
  console.error(
    "Workflow worker failed. Check database connectivity and configuration.",
  );
  process.exitCode = 1;
});
