import { withHookOwner } from "@/lib/security/routeAuth";
import { sameOrigin } from "@/lib/security/adminAuth";
import { workflowStore, StoreError } from "@/lib/workflows/store";
import {
  FormConfig,
  renderForm,
  verifyFormToken,
  formInput,
} from "@/lib/workflows/forms";
import { failure } from "@/lib/workflows/api";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { wakeWorkflow } from "@/lib/workflows/serverless";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };
const html = (text: string, status = 200) =>
  new Response(text, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    },
  });
async function published(id: string) {
  const workflow = await workflowStore.get(id),
    graph = await workflowStore.activeGraph(id);
  const trigger = graph?.nodes.find((n) => n.kind === "formTrigger");
  if (!workflow || !graph || !trigger)
    throw new StoreError("Form is not published", 404);
  return { workflow, graph, config: FormConfig.parse(trigger.config) };
}
export const GET = withHookOwner(
  async (_request: Request, context: Context) => {
    try {
      const { id } = await context.params;
      const { workflow, config } = await published(id);
      return html(renderForm(id, workflow.activeRevision!, config));
    } catch (error) {
      return failure(error);
    }
  },
);
export const POST = withHookOwner(
  async (request: Request, context: Context) => {
    try {
      if (!sameOrigin(request))
        throw new StoreError("Submit from the published form", 403);
      const { id } = await context.params;
      if (!checkRateLimit(`form:${id}`, 20).allowed)
        throw new StoreError("Too many submissions. Try later.", 429);
      if (
        !request.headers
          .get("content-type")
          ?.startsWith("application/x-www-form-urlencoded")
      )
        throw new StoreError("Use the published HTML form", 415);
      const reader = request.body?.getReader();
      if (!reader) throw new StoreError("Empty submission", 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 32000) {
            await reader.cancel();
            throw new StoreError("Form exceeds 32 KB", 413);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const values = new URLSearchParams(
        Buffer.concat(chunks).toString("utf8"),
      );
      const { workflow, graph, config } = await published(id);
      let nonce: string, input: Record<string, string>;
      try {
        nonce = verifyFormToken(
          values.get("token") ?? "",
          id,
          workflow.activeRevision!,
        );
        input = formInput(config, values);
      } catch (error) {
        return html(
          renderForm(id, workflow.activeRevision!, config, {
            message:
              error instanceof Error ? error.message : "Check your answers",
            values,
          }),
          400,
        );
      }
      const run = await workflowStore.enqueue(workflow, input, "form", {
        graph,
        revision: workflow.activeRevision!,
        eventKey: `form:${nonce}`,
      });
      if (run.status === "queued") wakeWorkflow(run.id);
      return html(
        "<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Request received · m8m</title><main><h1>Request received</h1><p>Your answers were accepted. Processing may continue in the background.</p></main></html>",
        202,
      );
    } catch (error) {
      return failure(error);
    }
  },
);
