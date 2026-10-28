import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { execute, query, runMigrations } from "@/lib/db/client";
import { ownerId, withOwner } from "@/lib/security/owner";
import { workflowStore } from "./store";
import { executeGraph } from "./engine";
import { pollTriggers } from "./triggers";
import { redact } from "./service";
import { trackExecution } from "./mlflow";
import type { NodeRun } from "./schema";

export const serverlessEnabled = () =>
  process.env.WORKFLOW_RUNTIME === "serverless";

// Capture authenticated ownership before leaving the request context.
export function wakeWorkflow(id: string) {
  if (!serverlessEnabled()) return;
  const account = ownerId();
  after(async () => {
    try {
      await runServerless({ id, ownerId: account });
    } catch {
      console.error(JSON.stringify({ event: "serverless.failed", runId: id }));
    }
  });
}

export async function runServerless(target?: { id: string; ownerId: string }) {
  await runMigrations();
  const workerId = `serverless:${randomUUID()}`;
  // Leave time for database writes and cleanup before Vercel's 300s cap.
  const deadline = Date.now() + 240000;
  let current: { id: string; ownerId: string } | undefined;
  let controller: AbortController | undefined;
  let beating = false;
  let locked = false;
  if (!target) {
    const lock = await query(
      "INSERT INTO worker_locks(name,holder,expires_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET holder=excluded.holder,expires_at=excluded.expires_at WHERE worker_locks.expires_at<? RETURNING holder",
      "triggers",
      workerId,
      Date.now() + 270000,
      Date.now(),
    );
    if (!lock.length) return { skipped: true, processed: 0 };
    locked = true;
  }
  const heartbeat = setInterval(async () => {
    if (beating) return;
    beating = true;
    try {
      await workflowStore.heartbeat(workerId, current?.id);
      if (
        current &&
        (
          await withOwner(current.ownerId, () =>
            workflowStore.getRun(current!.id),
          )
        )?.cancelRequested
      )
        controller?.abort();
    } catch {
      controller?.abort();
    } finally {
      beating = false;
    }
  }, 5000);
  let processed = 0;
  try {
    if (!target) {
      await execute(
        "INSERT INTO workflow_worker_health VALUES(?,?) ON CONFLICT(id) DO UPDATE SET heartbeat=excluded.heartbeat",
        "scheduler:last-tick",
        Date.now(),
      );
      const owners = await query(
        "SELECT DISTINCT w.owner_id FROM workflows w JOIN users u ON u.id=w.owner_id WHERE w.active_revision IS NOT NULL AND u.password_hash IS NOT NULL",
      );
      const pollSignal = AbortSignal.timeout(60000);
      for (const account of owners) {
        if (pollSignal.aborted) break;
        await withOwner(String(account.owner_id), () =>
          pollTriggers(pollSignal),
        );
      }
    }
    while (Date.now() < deadline - 10000) {
      const run = await workflowStore.claim(workerId, target);
      if (!run) break;
      current = { id: run.id, ownerId: run.ownerId };
      controller = new AbortController();
      await withOwner(run.ownerId, async () => {
        const result = await executeGraph(run.graph, run.input, {
          signal: AbortSignal.any([
            controller!.signal,
            AbortSignal.timeout(Math.max(1, deadline - Date.now())),
          ]),
          onProgress: async (steps) =>
            workflowStore.progress(run.id, (await redact(steps)) as NodeRun[]),
        });
        await workflowStore.finish(
          run.id,
          result.status,
          (await redact(result.steps)) as NodeRun[],
          await redact(result.output),
          result.error ? String(await redact(result.error)) : undefined,
        );
        await trackExecution((await workflowStore.getRun(run.id))!);
        console.log(
          JSON.stringify({
            event: "serverless.finished",
            runId: run.id,
            status: result.status,
          }),
        );
      });
      processed++;
      current = undefined;
      controller = undefined;
      if (target) break;
    }
    return { skipped: false, processed };
  } finally {
    clearInterval(heartbeat);
    if (locked)
      await execute(
        "DELETE FROM worker_locks WHERE name=? AND holder=?",
        "triggers",
        workerId,
      );
    await execute("DELETE FROM workflow_worker_health WHERE id=?", workerId);
  }
}
