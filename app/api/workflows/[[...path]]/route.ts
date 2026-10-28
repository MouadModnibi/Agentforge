import { withUser } from "@/lib/security/routeAuth";
import { z } from "zod";
import { workflowStore, StoreError } from "@/lib/workflows/store";
import { WorkflowInputSchema } from "@/lib/workflows/schema";
import { assertExecutable, validateReferences } from "@/lib/workflows/service";
import { ok, failure, body } from "@/lib/workflows/api";
import { wakeWorkflow } from "@/lib/workflows/serverless";
import { runtimeStatus } from "@/lib/workflows/runtime-status";
export const maxDuration = 300;
type Context = {
  params: Promise<{
    path?: string[];
  }>;
};
export const runtime = "nodejs";
export const GET = withUser(async function GET(
  _request: Request,
  ctx: Context,
) {
  try {
    const path = (await ctx.params).path ?? [];
    if (!path.length)
      return ok({
        workflows: await workflowStore.list(),
        workerOnline: await workflowStore.workerOnline(),
        ...(await runtimeStatus()),
      });
    const w = await workflowStore.get(path[0]);
    if (!w) throw new StoreError("Workflow not found", 404);
    if (path.length === 1) return ok(w);
    if (path[1] === "runs") return ok(await workflowStore.runs(w.id));
    if (path[1] === "versions") return ok(await workflowStore.versions(w.id));
    if (path[1] === "trigger-status")
      return ok(await workflowStore.triggerState(w.id));
    throw new StoreError("Endpoint not found", 404);
  } catch (e) {
    return failure(e);
  }
});
export const POST = withUser(async function POST(
  request: Request,
  ctx: Context,
) {
  try {
    const path = (await ctx.params).path ?? [];
    if (!path.length)
      return ok(
        await workflowStore.save(
          WorkflowInputSchema.parse(await body(request)),
        ),
        201,
      );
    const w = await workflowStore.get(path[0]);
    if (!w) throw new StoreError("Workflow not found", 404);
    switch (path[1]) {
      case "validate":
        return ok({ errors: await validateReferences(w.graph) });
      case "activate": {
        const { active } = z
          .object({ active: z.boolean() })
          .parse(await body(request));
        if (active) await assertExecutable(w.graph);
        await workflowStore.activate(w.id, active);
        return ok(await workflowStore.get(w.id));
      }
      case "run": {
        const { input } = z
          .object({ input: z.record(z.string(), z.unknown()).default({}) })
          .parse(await body(request));
        await assertExecutable(w.graph);
        const run = await workflowStore.enqueue(w, input);
        wakeWorkflow(run.id);
        return ok(run, 202);
      }
      case "webhook-key":
        return ok({ key: await workflowStore.rotateWebhookKey(w.id) });
      case "duplicate":
        return ok(
          await workflowStore.save({
            name: `${w.name} (copy)`,
            description: w.description,
            graph: w.graph,
          }),
          201,
        );
      case "restore": {
        const { revision } = z
          .object({ revision: z.number().int().positive() })
          .parse(await body(request));
        const v = (await workflowStore.versions(w.id)).find(
          (v) => v.revision === revision,
        );
        if (!v) throw new StoreError("Version not found", 404);
        return ok(await workflowStore.save({ ...w, graph: v.graph }, w.id));
      }
      default:
        throw new StoreError("Endpoint not found", 404);
    }
  } catch (e) {
    return failure(e);
  }
});
export const PATCH = withUser(async function PATCH(
  request: Request,
  ctx: Context,
) {
  try {
    const path = (await ctx.params).path ?? [];
    if (path.length !== 1) throw new StoreError("Endpoint not found", 404);
    return ok(
      await workflowStore.save(
        WorkflowInputSchema.parse(await body(request)),
        path[0],
      ),
    );
  } catch (e) {
    return failure(e);
  }
});
export const DELETE = withUser(async function DELETE(
  _request: Request,
  ctx: Context,
) {
  try {
    const path = (await ctx.params).path ?? [];
    if (path.length !== 1) throw new StoreError("Endpoint not found", 404);
    await workflowStore.delete(path[0]);
    return ok({ success: true });
  } catch (e) {
    return failure(e);
  }
});
