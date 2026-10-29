vi.mock("@/lib/security/accounts", () => ({
  sessionAccount: vi.fn(async () => ({
    id: "test-user",
    email: "test@example.com",
    name: "Test",
  })),
  cookieToken: () => undefined,
  accountModelKey: async () => null,
}));
import { withOwner } from "@/lib/security/owner";
const it = (name: string, fn: () => unknown) =>
  baseIt(name, () => withOwner("test-user", fn));
import { describe, it as baseIt, expect, vi, beforeEach } from "vitest";
vi.hoisted(() => {
  process.env.DATABASE_PATH = ":memory:";
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
});
vi.mock("@/lib/repositories/agents", () => ({
  agentsRepository: { findById: vi.fn(async () => null) },
}));
import { sqlite, execute, query } from "@/lib/db/client";
import { workflowStore, migrateWorkflows } from "@/lib/workflows/store";
import { templates } from "@/lib/workflows/templates";
import {
  GET,
  POST,
  PATCH,
  DELETE,
} from "@/app/api/workflows/[[...path]]/route";
import { POST as hook } from "@/app/api/workflow-hooks/[id]/route";
import { POST as runAction } from "@/app/api/workflow-runs/[id]/route";
import {
  GET as formPage,
  POST as submitForm,
} from "@/app/api/workflow-forms/[id]/route";
import { formToken } from "@/lib/workflows/forms";
import {
  POST as saveConnection,
  GET as listConnections,
} from "@/app/api/workflow-credentials/route";
import { redact, validateReferences } from "@/lib/workflows/service";
const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const req = (
  body: unknown,
  method = "POST",
  headers: Record<string, string> = {},
) =>
  new Request("http://localhost:3000/api/workflows", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
beforeEach(async () => {
  await migrateWorkflows();
  await execute(
    "INSERT OR IGNORE INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)",
    "test-user",
    "test@example.com",
    "Test",
    "fixture",
    Date.now(),
  );
  await sqlite.executeMultiple(
    "DELETE FROM workflow_runs;DELETE FROM workflow_versions;DELETE FROM workflows;",
  );
});
describe("workflow API", () => {
  it("saves encrypted Discord credentials, filters integration types and redacts URL/token", async () => {
    const webhookUrl =
      "https://discord.com/api/webhooks/123/discord-test-token";
    const response = await saveConnection(
      req({ name: "Discord QA", kind: "discord", values: { webhookUrl } }),
    );
    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data.kind).toBe("discord");
    expect(data.values).toBeUndefined();
    const listed = await listConnections(
      new Request("http://localhost:3000/api/workflow-credentials"),
    );
    expect(await listed.text()).not.toContain("discord-test-token");
    expect(
      (
        await query(
          "SELECT encrypted FROM workflow_credentials WHERE id=?",
          data.id,
        )
      )[0].encrypted,
    ).not.toContain("discord-test-token");
    const graph = structuredClone(
      templates.find((t) => t.id === "discord-message-test")!.graph,
    );
    graph.nodes.find((n) => n.kind === "discord")!.config.credentialId =
      data.id;
    expect(await validateReferences(graph)).toEqual([]);
    await expect(workflowStore.credential(data.id, "http")).rejects.toThrow(
      "wrong integration type",
    );
    const redacted = JSON.stringify(
      await redact({ url: webhookUrl, fragment: "discord-test-token" }),
    );
    expect(redacted).not.toContain("discord-test-token");
  });
  it("rejects invalid Discord credential URLs at the API boundary without echoing secrets", async () => {
    for (const webhookUrl of [
      "https://evil.test/api/webhooks/123/private-token",
      "http://discord.com/api/webhooks/123/private-token",
      "",
    ]) {
      const response = await saveConnection(
        req({
          name: "Invalid Discord",
          kind: "discord",
          values: { webhookUrl },
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain("private-token");
    }
  });
  it("publishes a form, validates fields and deduplicates double submissions", async () => {
    const oldSecret = process.env.APP_SECRET;
    process.env.APP_SECRET = "form-integration-test-secret-32-characters";
    try {
      const w = await workflowStore.save({
        name: "Form",
        description: "",
        graph: {
          nodes: [
            {
              id: "form",
              kind: "formTrigger",
              label: "Form",
              position: { x: 0, y: 0 },
              config: {
                title: "Request",
                fields: [
                  {
                    name: "text",
                    label: "Message",
                    type: "textarea",
                    required: true,
                  },
                ],
              },
              retry: { attempts: 1, delayMs: 1000 },
              timeoutMs: 30000,
            },
          ],
          edges: [],
        },
      });
      const context = { params: Promise.resolve({ id: w.id }) };
      expect(
        (await formPage(new Request("http://localhost:3000"), context)).status,
      ).toBe(404);
      await workflowStore.activate(w.id, true);
      const page = await formPage(
        new Request("http://localhost:3000"),
        context,
      );
      expect(page.status).toBe(200);
      expect(page.headers.get("referrer-policy")).toBe("same-origin");
      expect(await page.text()).toContain('name="text"');
      const token = formToken(w.id, 1);
      const submission = (
        text: string,
        signed = token,
        origin = "http://localhost:3000",
      ) =>
        new Request(`http://localhost:3000/api/workflow-forms/${w.id}`, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            origin,
          },
          body: new URLSearchParams({ token: signed, text }),
        });
      expect(
        (await submitForm(submission("hello", "invalid"), context)).status,
      ).toBe(400);
      expect((await submitForm(submission(""), context)).status).toBe(400);
      expect(
        (
          await submitForm(
            submission("hello", token, "https://evil.test"),
            context,
          )
        ).status,
      ).toBe(403);
      expect(await workflowStore.runs(w.id)).toHaveLength(0);
      expect((await submitForm(submission("hello"), context)).status).toBe(202);
      expect((await submitForm(submission("hello"), context)).status).toBe(202);
      expect(await workflowStore.runs(w.id)).toHaveLength(1);
    } finally {
      if (oldSecret === undefined) delete process.env.APP_SECRET;
      else process.env.APP_SECRET = oldSecret;
    }
  });
  it("creates and lists workflows", async () => {
    const r = await POST(
      req({ name: "API test", graph: templates[1].graph }),
      ctx(),
    );
    expect(r.status).toBe(201);
    const response = await GET(new Request("http://localhost"), ctx());
    expect((await response.json()).data.workflows).toHaveLength(1);
  });
  it("rejects invalid request data", async () => {
    expect((await POST(req({ name: "" }), ctx())).status).toBe(400);
  });
  it("rejects malformed JSON", async () => {
    expect(
      (
        await POST(
          new Request("http://localhost", { method: "POST", body: "broken" }),
          ctx(),
        )
      ).status,
    ).toBe(400);
  });
  it("updates with revision checking", async () => {
    const w = await workflowStore.save({
      name: "Test",
      description: "",
      graph: templates[1].graph,
    });
    expect(
      (await PATCH(req({ ...w, name: "Changed" }, "PATCH"), ctx(w.id))).status,
    ).toBe(200);
    expect(
      (await PATCH(req({ ...w, name: "Stale" }, "PATCH"), ctx(w.id))).status,
    ).toBe(409);
  });
  it("returns 404 for absent workflows", async () => {
    expect(
      (await GET(new Request("http://localhost"), ctx("missing"))).status,
    ).toBe(404);
  });
  it("validates before activation", async () => {
    const g = structuredClone(templates[1].graph);
    g.edges = [];
    const w = await workflowStore.save({
      name: "Invalid",
      description: "",
      graph: g,
    });
    expect(
      (await POST(req({ active: true }), ctx(w.id, "activate"))).status,
    ).toBe(422);
  });
  it("enqueues an asynchronous manual execution", async () => {
    const w = await workflowStore.save({
      name: "Test",
      description: "",
      graph: templates[1].graph,
    });
    const r = await POST(
      req({ input: { text: "Hello", priority: "high" } }),
      ctx(w.id, "run"),
    );
    expect(r.status).toBe(202);
    expect((await r.json()).data.status).toBe("queued");
  });
  it("deletes workflows after outstanding jobs are cleared", async () => {
    const w = await workflowStore.save({
      name: "Test",
      description: "",
      graph: templates[1].graph,
    });
    const r = await workflowStore.enqueue(w, {});
    expect(
      (await DELETE(new Request("http://localhost"), ctx(w.id))).status,
    ).toBe(409);
    await workflowStore.cancel(r.id);
    expect(
      (await DELETE(new Request("http://localhost"), ctx(w.id))).status,
    ).toBe(200);
  });
  it("requires explicit side-effect acknowledgement before full retry", async () => {
    const w = await workflowStore.save({
        name: "Test",
        description: "",
        graph: templates[1].graph,
      }),
      r = await workflowStore.enqueue(w, {});
    await workflowStore.claim("worker");
    await workflowStore.finish(r.id, "failed", r.steps, null, "failed");
    const context = { params: Promise.resolve({ id: r.id }) };
    expect((await runAction(req({ action: "retry" }), context)).status).toBe(
      409,
    );
    expect(
      (
        await runAction(
          req({ action: "retry", acknowledgeSideEffects: true }),
          context,
        )
      ).status,
    ).toBe(202);
  });
});
describe("authenticated workflow webhooks", () => {
  async function setup() {
    const g = structuredClone(templates[0].graph);
    g.nodes[0].kind = "webhook";
    const w = await workflowStore.save({
        name: "Hook",
        description: "",
        graph: g,
      }),
      key = await workflowStore.rotateWebhookKey(w.id);
    return { w, key, context: { params: Promise.resolve({ id: w.id }) } };
  }
  it("rejects inactive hooks", async () => {
    const { key, context } = await setup();
    expect(
      (
        await hook(
          req({ text: "hello" }, "POST", { authorization: `Bearer ${key}` }),
          context,
        )
      ).status,
    ).toBe(404);
  });
  it("rejects missing/wrong hook keys", async () => {
    const { w, context } = await setup();
    await workflowStore.activate(w.id, true);
    expect((await hook(req({ text: "hello" }), context)).status).toBe(401);
  });
  it("enqueues and deduplicates authenticated events", async () => {
    const { w, key, context } = await setup();
    await workflowStore.activate(w.id, true);
    const request = () =>
      req({ text: "hello" }, "POST", {
        authorization: `Bearer ${key}`,
        "idempotency-key": "unique-event",
      });
    const a = await hook(request(), context),
      b = await hook(request(), context);
    expect(a.status).toBe(202);
    expect((await a.json()).data.runId).toBe((await b.json()).data.runId);
    expect(await workflowStore.runs(w.id)).toHaveLength(1);
  });
  it("checks Telegram secret headers", async () => {
    const c = await workflowStore.saveCredential({
        name: "Bot",
        kind: "telegram",
        values: { botToken: "12345:token", webhookSecret: "testsecret" },
      }),
      g = structuredClone(templates[0].graph);
    g.nodes[0].kind = "telegramTrigger";
    g.nodes[0].config = { credentialId: c.id };
    const w = await workflowStore.save({
      name: "Bot",
      description: "",
      graph: g,
    });
    await workflowStore.activate(w.id, true);
    const context = { params: Promise.resolve({ id: w.id }) },
      payload = {
        update_id: 123,
        message: { text: "hello", chat: { id: 456 } },
      };
    expect((await hook(req(payload), context)).status).toBe(401);
    const r = await hook(
      req(payload, "POST", { "x-telegram-bot-api-secret-token": "testsecret" }),
      context,
    );
    expect(r.status).toBe(202);
    expect((await workflowStore.runs(w.id))[0].input).toEqual({
      text: "hello",
      chatId: 456,
      updateId: 123,
    });
  });
});
