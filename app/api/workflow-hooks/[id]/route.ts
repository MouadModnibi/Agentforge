import { withHookOwner } from "@/lib/security/routeAuth";
import { NextResponse } from "next/server";
import { workflowStore, StoreError } from "@/lib/workflows/store";
import { safeEqual } from "@/lib/security/adminAuth";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { ok, failure, body } from "@/lib/workflows/api";
import { z } from "zod";
import { wakeWorkflow } from "@/lib/workflows/serverless";
export const runtime = "nodejs";
export const maxDuration = 300;
export const POST = withHookOwner(async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const { id } = await params;
    if (!checkRateLimit(`hook:${id}`, 60).allowed)
      return NextResponse.json(
        { error: { message: "Webhook rate limit reached" } },
        { status: 429 },
      );
    const w = await workflowStore.get(id),
      graph = await workflowStore.activeGraph(id);
    if (!w || !graph)
      throw new StoreError("Webhook is inactive or does not exist", 404);
    const trigger = graph.nodes.find((n) =>
      ["webhook", "telegramTrigger"].includes(n.kind),
    );
    if (!trigger)
      throw new StoreError("This workflow does not have an HTTP trigger", 422);
    let eventKey = request.headers.get("idempotency-key")?.slice(0, 200),
      input: Record<string, unknown>;
    if (trigger.kind === "telegramTrigger") {
      const secret = await workflowStore.credential(
        String(trigger.config.credentialId),
        "telegram",
      );
      if (
        !secret.webhookSecret ||
        !safeEqual(
          request.headers.get("x-telegram-bot-api-secret-token") ?? "",
          secret.webhookSecret,
        )
      )
        throw new StoreError("Invalid webhook signature", 401);
      const payload = z
        .object({
          update_id: z.number().int(),
          message: z
            .object({
              text: z.string().optional(),
              chat: z.object({ id: z.number() }),
            })
            .optional(),
        })
        .passthrough()
        .parse(await body(request));
      if (!payload.message) return ok({ ignored: true });
      input = {
        text: payload.message.text ?? "",
        chatId: payload.message.chat.id,
        updateId: payload.update_id,
      };
      eventKey = `telegram:${payload.update_id}`;
    } else {
      const key =
        request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      if (!(await workflowStore.checkWebhookKey(id, key)))
        throw new StoreError("Invalid webhook key", 401);
      input = z.record(z.string(), z.unknown()).parse(await body(request));
    }
    const run = await workflowStore.enqueue(w, input, trigger.kind, {
      graph,
      revision: w.activeRevision!,
      eventKey,
    });
    if (run.status === "queued") wakeWorkflow(run.id);
    return ok({ runId: run.id, status: run.status }, 202);
  } catch (e) {
    return failure(e);
  }
});
