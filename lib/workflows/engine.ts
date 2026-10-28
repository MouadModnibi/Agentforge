import { topologicalOrder, validateGraph } from "./graph";
import { isTrigger } from "./catalog";
import type { WorkflowGraph, NodeRun, RunStatus } from "./schema";
import { executeNode, type NodeExecutor } from "./executors";
export interface EngineResult {
  status: RunStatus;
  steps: NodeRun[];
  output: unknown;
  error?: string;
}
async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let listener: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    listener = () => reject(signal.reason);
    signal.addEventListener("abort", listener, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", listener);
  }
}
export async function executeGraph(
  graph: WorkflowGraph,
  input: Record<string, unknown>,
  options: {
    signal?: AbortSignal;
    executor?: NodeExecutor;
    onProgress?: (steps: NodeRun[]) => void | Promise<void>;
  } = {},
): Promise<EngineResult> {
  const errors = validateGraph(graph);
  if (errors.length)
    return {
      status: "failed",
      steps: [],
      output: null,
      error: errors.join(" "),
    };
  const steps: NodeRun[] = graph.nodes.map((n) => ({
      nodeId: n.id,
      label: n.label,
      kind: n.kind,
      status: "pending",
      attempt: 0,
    })),
    outputs: Record<string, unknown> = {};
  const progress = () => options.onProgress?.(structuredClone(steps));
  const signal = options.signal ?? new AbortController().signal;
  let finalOutput: unknown = input;
  try {
    for (const id of topologicalOrder(graph)) {
      signal.throwIfAborted();
      const node = graph.nodes.find((n) => n.id === id)!,
        step = steps.find((s) => s.nodeId === id)!;
      const incoming = graph.edges.filter((e) => e.target === id);
      const active = incoming.filter((e) => {
        const parent = steps.find((s) => s.nodeId === e.source)!;
        return (
          parent.status === "succeeded" &&
          (!parent.branch || parent.branch === e.sourceHandle)
        );
      });
      if (!isTrigger(node.kind) && active.length === 0) {
        step.status = "skipped";
        await progress();
        continue;
      }
      // Joins execute once, after all predecessors finish. Multiple active inputs are keyed by source ID.
      const nodeInput = isTrigger(node.kind)
        ? input
        : active.length === 1
          ? outputs[active[0].source]
          : Object.fromEntries(
              active.map((e) => [e.source, outputs[e.source]]),
            );
      step.input = nodeInput;
      step.startedAt = Date.now();
      step.status = "running";
      await progress();
      for (let attempt = 1; attempt <= node.retry.attempts; attempt++) {
        step.attempt = attempt;
        const timeout = AbortSignal.timeout(node.timeoutMs),
          nodeSignal = AbortSignal.any([signal, timeout]);
        try {
          const result = await abortable(
            (options.executor ?? executeNode)(node, {
              input: nodeInput,
              trigger: input,
              nodes: outputs,
              signal: nodeSignal,
            }),
            nodeSignal,
          );
          nodeSignal.throwIfAborted();
          if (
            Buffer.byteLength(JSON.stringify(result.output ?? null)) >
            1024 * 1024
          )
            throw new Error("Node output exceeds 1 MB limit");
          step.output = result.output;
          step.branch = result.branch;
          step.usage = result.usage;
          outputs[id] = result.output;
          finalOutput = result.output;
          step.status = "succeeded";
          step.finishedAt = Date.now();
          await progress();
          break;
        } catch (error) {
          if (signal.aborted) throw error;
          if (attempt < node.retry.attempts) {
            await new Promise<void>((resolve, reject) => {
              const onAbort = () => {
                clearTimeout(timer);
                reject(signal.reason);
              };
              const timer = setTimeout(() => {
                signal.removeEventListener("abort", onAbort);
                resolve();
              }, node.retry.delayMs * attempt);
              signal.addEventListener("abort", onAbort, { once: true });
            });
            continue;
          }
          step.status = "failed";
          step.error = timeout.aborted
            ? `Node timed out after ${node.timeoutMs} ms`
            : error instanceof Error
              ? error.message
              : String(error);
          step.finishedAt = Date.now();
          await progress();
          throw new Error(`${node.label}: ${step.error}`);
        }
      }
    }
    return { status: "succeeded", steps, output: finalOutput };
  } catch (error) {
    const timedOut = signal.aborted && signal.reason?.name === "TimeoutError";
    const cancelled = signal.aborted && !timedOut;
    for (const step of steps)
      if (step.status === "pending" || step.status === "running") {
        if (timedOut && step.status === "running") {
          step.status = "failed";
          step.error = "Workflow runtime limit exceeded";
          step.finishedAt = Date.now();
        } else step.status = cancelled ? "cancelled" : "skipped";
      }
    return {
      status: cancelled ? "cancelled" : "failed",
      steps,
      output: finalOutput,
      error: timedOut
        ? "Workflow runtime limit exceeded"
        : cancelled
          ? "Execution cancelled"
          : error instanceof Error
            ? error.message
            : String(error),
    };
  }
}
