import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/workflows/executors", () => ({ executeNode: vi.fn() }));
import { executeGraph } from "@/lib/workflows/engine";
import { templates } from "@/lib/workflows/templates";
import type { NodeExecutor } from "@/lib/workflows/executors";
const graph = () =>
  structuredClone(templates.find((t) => t.id === "routing")!.graph);
describe("workflow execution", () => {
  it("runs only the chosen condition path", async () => {
    const calls: string[] = [];
    const executor: NodeExecutor = async (n, ctx) => {
      calls.push(n.id);
      return n.kind === "condition"
        ? { output: ctx.input, branch: "true" }
        : { output: ctx.input };
    };
    const r = await executeGraph(graph(), { priority: "high" }, { executor });
    expect(r.status).toBe("succeeded");
    expect(calls).toEqual(["start", "priority", "urgent"]);
    expect(r.steps.find((s) => s.nodeId === "normal")?.status).toBe("skipped");
  });
  it("propagates predecessor output to the next node", async () => {
    const values: unknown[] = [];
    await executeGraph(
      graph(),
      { test: 1 },
      {
        executor: async (n, c) => {
          values.push(c.input);
          return n.kind === "condition"
            ? { output: { value: 2 }, branch: "false" }
            : { output: c.input };
        },
      },
    );
    expect(values.at(-1)).toEqual({ value: 2 });
  });
  it("reports executor errors and skips remaining nodes", async () => {
    const r = await executeGraph(
      graph(),
      {},
      {
        executor: async (n) => {
          if (n.id === "priority") throw new Error("broken");
          return { output: {} };
        },
      },
    );
    expect(r.status).toBe("failed");
    expect(r.error).toContain("broken");
    expect(r.steps.find((s) => s.nodeId === "urgent")?.status).toBe("skipped");
  });
  it("cancels before any node starts", async () => {
    const c = new AbortController();
    c.abort();
    const executor = vi.fn();
    const r = await executeGraph(graph(), {}, { signal: c.signal, executor });
    expect(r.status).toBe("cancelled");
    expect(executor).not.toHaveBeenCalled();
  });
  it("cancels a non-cooperating executor", async () => {
    const c = new AbortController();
    const promise = executeGraph(
      graph(),
      {},
      { signal: c.signal, executor: () => new Promise(() => {}) },
    );
    setTimeout(() => c.abort(), 5);
    expect((await promise).status).toBe("cancelled");
  });
  it("enforces node timeout even if executor ignores the signal", async () => {
    const g = graph();
    g.nodes[0].timeoutMs = 100;
    const r = await executeGraph(
      g,
      {},
      { executor: () => new Promise(() => {}) },
    );
    expect(r.status).toBe("failed");
    expect(r.error).toContain("timed out");
  });
  it("marks an overall deadline as failure rather than user cancellation", async () => {
    const r = await executeGraph(
      graph(),
      {},
      {
        signal: AbortSignal.timeout(20),
        executor: () => new Promise(() => {}),
      },
    );
    expect(r.status).toBe("failed");
    expect(r.error).toContain("runtime limit");
    expect(r.steps[0].status).toBe("failed");
  });
  it("retries pure nodes within their attempt budget", async () => {
    const g = graph();
    g.nodes[0].retry = { attempts: 2, delayMs: 100 };
    let attempts = 0;
    const r = await executeGraph(
      g,
      {},
      {
        executor: async (n) => {
          if (n.id === "start" && ++attempts === 1)
            throw new Error("transient");
          return n.kind === "condition"
            ? { output: {}, branch: "true" }
            : { output: {} };
        },
      },
    );
    expect(r.status).toBe("succeeded");
    expect(r.steps[0].attempt).toBe(2);
  });
  it("persists progress in execution order", async () => {
    const statuses: string[] = [];
    await executeGraph(
      graph(),
      {},
      {
        onProgress: (s) => {
          statuses.push(s[0].status);
        },
        executor: async (n) =>
          n.kind === "condition"
            ? { output: {}, branch: "false" }
            : { output: {} },
      },
    );
    expect(statuses[0]).toBe("running");
    expect(statuses).toContain("succeeded");
  });
  it("rejects outputs above the payload limit", async () => {
    const r = await executeGraph(
      graph(),
      {},
      { executor: async () => ({ output: "x".repeat(1024 * 1024 + 1) }) },
    );
    expect(r.status).toBe("failed");
    expect(r.error).toContain("1 MB");
  });
  it("refuses invalid graphs before executing", async () => {
    const g = graph();
    g.edges = [];
    const executor = vi.fn();
    expect((await executeGraph(g, {}, { executor })).status).toBe("failed");
    expect(executor).not.toHaveBeenCalled();
  });
});
