import { withOwner } from "@/lib/security/owner";
const it = (name: string, fn: () => unknown) =>
  baseIt(name, () => withOwner("test-user", fn));
import { describe, it as baseIt, expect, vi, beforeEach } from "vitest";
vi.hoisted(() => {
  process.env.DATABASE_PATH = ":memory:";
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
});
import { sqlite, execute, query } from "@/lib/db/client";
import { workflowStore, migrateWorkflows } from "@/lib/workflows/store";
import { templates } from "@/lib/workflows/templates";
const create = async () =>
  await workflowStore.save({
    name: "Test",
    description: "",
    graph: structuredClone(templates[1].graph),
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
    "DELETE FROM workflow_runs;DELETE FROM workflow_versions;DELETE FROM workflows;DELETE FROM workflow_credentials;DELETE FROM workflow_worker_health;",
  );
});
describe("durable workflow storage", () => {
  it("claims only the requested owner's job and leaves other queued work alone", async () => {
    const w = await create();
    const first = await workflowStore.enqueue(w, {});
    const second = await workflowStore.enqueue(w, {});
    expect(
      await workflowStore.claim("wrong", { id: second.id, ownerId: "other" }),
    ).toBeNull();
    expect(
      (
        await workflowStore.claim("target", {
          id: second.id,
          ownerId: "test-user",
        })
      )?.id,
    ).toBe(second.id);
    expect(
      await workflowStore.claim("duplicate", {
        id: second.id,
        ownerId: "test-user",
      }),
    ).toBeNull();
    expect((await workflowStore.claim("queue"))?.id).toBe(first.id);
  });
  it("creates workflows and immutable revisions", async () => {
    const w = await create();
    await workflowStore.save({ ...w, name: "Changed" }, w.id);
    expect((await workflowStore.versions(w.id)).map((v) => v.revision)).toEqual(
      [2, 1],
    );
  });
  it("rejects lost updates", async () => {
    const w = await create();
    await workflowStore.save(w, w.id);
    await expect(async () => await workflowStore.save(w, w.id)).rejects.toThrow(
      "changed elsewhere",
    );
  });
  it("keeps active revision pinned after editing", async () => {
    const w = await create();
    await workflowStore.activate(w.id, true);
    const next = structuredClone(w);
    next.graph.nodes[0].label = "edited";
    await workflowStore.save(next, w.id);
    expect((await workflowStore.get(w.id))?.activeRevision).toBe(1);
    expect((await workflowStore.activeGraph(w.id))?.nodes[0].label).toBe(
      w.graph.nodes[0].label,
    );
  });
  it("deduplicates repeated trigger events", async () => {
    const w = await create(),
      a = await workflowStore.enqueue(w, {}, "webhook", { eventKey: "event" }),
      b = await workflowStore.enqueue(w, {}, "webhook", { eventKey: "event" });
    expect(a.id).toBe(b.id);
    expect(await workflowStore.runs(w.id)).toHaveLength(1);
  });
  it("claims jobs once", async () => {
    await workflowStore.enqueue(await create(), {});
    expect(await workflowStore.claim("one")).not.toBeNull();
    expect(await workflowStore.claim("two")).toBeNull();
  });
  it("marks expired worker leases interrupted instead of replaying actions", async () => {
    const w = await create(),
      r = await workflowStore.enqueue(w, {});
    await workflowStore.claim("one");
    await execute("UPDATE workflow_runs SET lease_until=0 WHERE id=?", r.id);
    expect(await workflowStore.claim("two")).toBeNull();
    expect((await workflowStore.getRun(r.id))?.status).toBe("interrupted");
  });
  it("cancels queued runs immediately", async () => {
    const r = await workflowStore.enqueue(await create(), {});
    await workflowStore.cancel(r.id);
    expect((await workflowStore.getRun(r.id))?.status).toBe("cancelled");
    expect(await workflowStore.claim("one")).toBeNull();
  });
  it("requests cancellation of running executions", async () => {
    const r = await workflowStore.enqueue(await create(), {});
    await workflowStore.claim("one");
    await workflowStore.cancel(r.id);
    expect((await workflowStore.getRun(r.id))?.cancelRequested).toBe(true);
  });
  it("does not delete workflows with outstanding runs", async () => {
    const w = await create();
    await workflowStore.enqueue(w, {});
    await expect(async () => await workflowStore.delete(w.id)).rejects.toThrow(
      "Cancel",
    );
  });
  it("stores credentials encrypted and lists only metadata", async () => {
    const c = await workflowStore.saveCredential({
      name: "Bot",
      kind: "telegram",
      values: { botToken: "12345:secret-token", webhookSecret: "a-secret" },
    });
    const raw = (await query("SELECT encrypted FROM workflow_credentials"))[0];
    expect(raw.encrypted).not.toContain("secret-token");
    expect((await workflowStore.credentials())[0]).not.toHaveProperty("values");
    expect((await workflowStore.credential(c.id, "telegram")).botToken).toBe(
      "12345:secret-token",
    );
  });
  it("prevents credential deletion while referenced", async () => {
    const c = await workflowStore.saveCredential({
      name: "Bot",
      kind: "telegram",
      values: { botToken: "secret" },
    });
    const g = structuredClone(templates[0].graph);
    g.nodes[0].kind = "telegramTrigger";
    g.nodes[0].config = { credentialId: c.id };
    await workflowStore.save({ name: "Bot", description: "", graph: g });
    await expect(
      async () => await workflowStore.deleteCredential(c.id),
    ).rejects.toThrow("referenced");
  });
  it("hashes webhook keys and revokes the previous key on rotation", async () => {
    const w = await create(),
      key = await workflowStore.rotateWebhookKey(w.id);
    expect(await workflowStore.checkWebhookKey(w.id, key)).toBe(true);
    expect(await workflowStore.checkWebhookKey(w.id, "wrong")).toBe(false);
    await workflowStore.rotateWebhookKey(w.id);
    expect(await workflowStore.checkWebhookKey(w.id, key)).toBe(false);
  });
  it("stores retry lineage and pinned graph", async () => {
    const w = await create(),
      first = await workflowStore.enqueue(w, { text: "old" }),
      next = await workflowStore.enqueue(w, first.input, "retry", {
        graph: first.graph,
        revision: first.revision,
        retryOf: first.id,
      });
    expect(next.retryOf).toBe(first.id);
    expect(next.graph).toEqual(first.graph);
  });
});
