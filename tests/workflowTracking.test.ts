import { describe, it, expect, vi, afterEach } from "vitest";
import { trackExecution } from "@/lib/workflows/mlflow";
import type { WorkflowRun } from "@/lib/workflows/schema";
const run = {
  id: "run1",
  workflowId: "workflow1",
  revision: 1,
  status: "succeeded",
  startedAt: 100,
  finishedAt: 200,
  createdAt: 50,
  steps: [
    { nodeId: "agent", usage: { promptTokens: 10, completionTokens: 5 } },
  ],
  input: { secret: "never export" },
} as unknown as WorkflowRun;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("optional MLflow tracking", () => {
  it("ignores malformed tracking configuration without stopping execution", async () => {
    vi.stubEnv("MLFLOW_TRACKING_URI", "not a URL");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(trackExecution(run)).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does nothing when disabled", async () => {
    vi.stubEnv("MLFLOW_TRACKING_URI", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await trackExecution(run);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("exports metrics without execution payloads", async () => {
    vi.stubEnv("MLFLOW_TRACKING_URI", "http://localhost:5000");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ experiment: { experiment_id: "1" } }),
      )
      .mockResolvedValueOnce(
        Response.json({ run: { info: { run_id: "ml1" } } }),
      )
      .mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    await trackExecution(run);
    expect(fetch).toHaveBeenCalledTimes(4);
    const payload = fetch.mock.calls.map((c) => c[1]?.body ?? "").join(" ");
    expect(payload).toContain("promptTokens");
    expect(payload).not.toContain("never export");
    expect(payload).not.toContain('"input"');
  });
  it("isolates tracking failures from workflow results", async () => {
    vi.stubEnv("MLFLOW_TRACKING_URI", "http://localhost:5000");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(trackExecution(run)).resolves.toBeUndefined();
  });
});
