import { withUser } from "@/lib/security/routeAuth";
import { z } from "zod";
import { workflowStore, StoreError } from "@/lib/workflows/store";
import { ok, failure, body } from "@/lib/workflows/api";
import { assertExecutable } from "@/lib/workflows/service";
import { wakeWorkflow } from "@/lib/workflows/serverless";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = {
  params: Promise<{
    id: string;
  }>;
};
export const GET = withUser(async function GET(
  _request: Request,
  ctx: Context,
) {
  try {
    const run = await workflowStore.getRun((await ctx.params).id);
    if (!run) throw new StoreError("Execution not found", 404);
    return ok(run);
  } catch (e) {
    return failure(e);
  }
});
export const POST = withUser(async function POST(
  request: Request,
  ctx: Context,
) {
  try {
    const run = await workflowStore.getRun((await ctx.params).id);
    if (!run) throw new StoreError("Execution not found", 404);
    const { action, acknowledgeSideEffects } = z
      .object({
        action: z.enum(["cancel", "retry"]),
        acknowledgeSideEffects: z.boolean().default(false),
      })
      .parse(await body(request));
    if (action === "cancel") {
      await workflowStore.cancel(run.id);
      return ok(await workflowStore.getRun(run.id));
    }
    if (!["failed", "cancelled", "interrupted"].includes(run.status))
      throw new StoreError(
        "Only failed, cancelled or interrupted runs can be retried",
        409,
      );
    if (!acknowledgeSideEffects)
      throw new StoreError(
        "Retry starts the entire saved graph again and may repeat external actions. Confirm before retrying.",
        409,
      );
    await assertExecutable(run.graph);
    const retry = await workflowStore.enqueue(
      (await workflowStore.get(run.workflowId))!,
      run.input,
      "retry",
      { graph: run.graph, revision: run.revision, retryOf: run.id },
    );
    wakeWorkflow(retry.id);
    return ok(retry, 202);
  } catch (e) {
    return failure(e);
  }
});
