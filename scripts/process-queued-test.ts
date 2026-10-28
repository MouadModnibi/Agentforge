import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
loadEnvConfig(process.cwd());
async function main() {
  const { query, execute, runMigrations } = await import("../lib/db/client");
  const { withOwner } = await import("../lib/security/owner");
  const { workflowStore } = await import("../lib/workflows/store");
  const { executeGraph } = await import("../lib/workflows/engine");
  const { redact } = await import("../lib/workflows/service");
  await runMigrations();
  const [u] = await query(
    "SELECT id FROM users WHERE email=? COLLATE NOCASE",
    process.argv[2],
  );
  if (!u) throw new Error("Account not found");
  await withOwner(String(u.id), async () => {
    const id = process.argv[3],
      worker = randomUUID();
    const run = await workflowStore.getRun(id);
    if (!run || run.status !== "queued" || run.source !== "manual")
      throw new Error("Only an existing queued manual test can be processed");
    const now = Date.now();
    const claimed = await query(
      "UPDATE workflow_runs SET status='running',started_at=?,lease_until=?,worker_id=? WHERE id=? AND status='queued' AND workflow_id IN (SELECT id FROM workflows WHERE owner_id=?) RETURNING id",
      now,
      now + 60000,
      worker,
      id,
      String(u.id),
    );
    if (!claimed.length)
      throw new Error("Another worker already picked up the test");
    const beat = setInterval(() => {
      void workflowStore.heartbeat(worker, id);
    }, 5000);
    try {
      const result = await executeGraph(run.graph, run.input, {
        signal: AbortSignal.timeout(120000),
        onProgress: async (steps) =>
          workflowStore.progress(id, (await redact(steps)) as typeof steps),
      });
      await workflowStore.finish(
        id,
        result.status,
        (await redact(result.steps)) as typeof result.steps,
        await redact(result.output),
        result.error ? String(await redact(result.error)) : undefined,
      );
      console.log(
        JSON.stringify(
          {
            id,
            status: result.status,
            error: result.error ? await redact(result.error) : null,
            steps: result.steps.map((s) => ({
              label: s.label,
              status: s.status,
              error: s.error ? "See execution details" : undefined,
            })),
          },
          null,
          2,
        ),
      );
    } finally {
      clearInterval(beat);
      await execute("DELETE FROM workflow_worker_health WHERE id=?", worker);
    }
  });
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
