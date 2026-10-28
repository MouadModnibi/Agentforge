import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.hoisted(() => {
  process.env.DATABASE_PATH = ":memory:";
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
});
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/workflows/triggers", () => ({ pollTriggers: vi.fn() }));
import { after } from "next/server";
import { execute, sqlite, runMigrations } from "@/lib/db/client";
import { withOwner } from "@/lib/security/owner";
import { workflowStore } from "@/lib/workflows/store";
import { runServerless, wakeWorkflow } from "@/lib/workflows/serverless";
import { pollTriggers } from "@/lib/workflows/triggers";
import { templates } from "@/lib/workflows/templates";
beforeEach(async () => {
  vi.clearAllMocks();
  await runMigrations();
  await execute(
    "INSERT OR IGNORE INTO users(id,email,name,password_hash,created_at) VALUES('runner-user','runner@example.com','Runner','fixture',0)",
  );
  await sqlite.executeMultiple(
    "DELETE FROM workflow_runs;DELETE FROM workflow_versions;DELETE FROM workflows;DELETE FROM worker_locks;DELETE FROM workflow_worker_health;",
  );
});
afterEach(() => vi.unstubAllEnvs());
const enqueue = () =>
  withOwner("runner-user", async () => {
    const w = await workflowStore.save({
      name: "Offline test",
      description: "",
      graph: templates[0].graph,
    });
    return workflowStore.enqueue(w, { text: "offline test" });
  });
it("executes a targeted offline job under its owner without polling or draining unrelated jobs", async () => {
  const first = await enqueue();
  const second = await enqueue();
  expect(await runServerless({ id: second.id, ownerId: "other" })).toEqual({
    skipped: false,
    processed: 0,
  });
  expect(
    await runServerless({ id: second.id, ownerId: "runner-user" }),
  ).toEqual({ skipped: false, processed: 1 });
  await withOwner("runner-user", async () => {
    expect((await workflowStore.getRun(second.id))?.status).toBe("succeeded");
    expect((await workflowStore.getRun(first.id))?.status).toBe("queued");
  });
  expect(pollTriggers).not.toHaveBeenCalled();
});
it("does not overlap a scheduled poll already holding the shared trigger lock", async () => {
  await execute(
    "INSERT INTO worker_locks(name,holder,expires_at) VALUES('triggers','another-worker',?)",
    Date.now() + 60000,
  );
  expect(await runServerless()).toEqual({ skipped: true, processed: 0 });
  expect(pollTriggers).not.toHaveBeenCalled();
});
it("uses the scheduled tick to drain jobs missed by immediate callbacks", async () => {
  const run = await enqueue();
  expect((await runServerless()).processed).toBe(1);
  expect(
    (await withOwner("runner-user", () => workflowStore.getRun(run.id)))
      ?.status,
  ).toBe("succeeded");
});
it("captures ownership when waking a job and stays disabled for the local worker", async () => {
  vi.stubEnv("WORKFLOW_RUNTIME", "worker");
  wakeWorkflow("unused");
  expect(after).not.toHaveBeenCalled();
  const run = await enqueue();
  vi.stubEnv("WORKFLOW_RUNTIME", "serverless");
  withOwner("runner-user", () => wakeWorkflow(run.id));
  await (vi.mocked(after).mock.calls[0][0] as () => Promise<void>)();
  expect(
    (await withOwner("runner-user", () => workflowStore.getRun(run.id)))
      ?.status,
  ).toBe("succeeded");
});
