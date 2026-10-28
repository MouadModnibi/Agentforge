import { GraphSchema, type WorkflowGraph } from "./schema";
import { isTrigger, outputHandles } from "./catalog";
export function validateGraph(graph: WorkflowGraph): string[] {
  const parsed = GraphSchema.safeParse(graph);
  if (!parsed.success)
    return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const errors: string[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length) errors.push("Node IDs must be unique.");
  if (new Set(graph.edges.map((e) => e.id)).size !== graph.edges.length)
    errors.push("Edge IDs must be unique.");
  const triggers = graph.nodes.filter((n) => isTrigger(n.kind));
  if (triggers.length !== 1)
    errors.push("A workflow needs exactly one trigger.");
  for (const edge of graph.edges) {
    const source = graph.nodes.find((n) => n.id === edge.source),
      target = graph.nodes.find((n) => n.id === edge.target);
    if (!source || !target) {
      errors.push(`Connection ${edge.id} references a missing node.`);
      continue;
    }
    if (source.id === target.id)
      errors.push("A node cannot connect to itself.");
    if (isTrigger(target.kind))
      errors.push("Triggers cannot have incoming connections.");
    if (!outputHandles(source).includes(edge.sourceHandle))
      errors.push(`Unknown output ${edge.sourceHandle} on ${source.label}.`);
  }
  const pairs = graph.edges.map(
    (e) => `${e.source}:${e.sourceHandle}:${e.target}`,
  );
  if (new Set(pairs).size !== pairs.length)
    errors.push("Duplicate connections are not allowed.");
  try {
    topologicalOrder(graph);
  } catch {
    errors.push("Workflow contains a cycle. Loops are not supported.");
  }
  if (triggers.length === 1) {
    const reached = new Set([triggers[0].id]);
    for (let i = 0; i < graph.nodes.length; i++)
      for (const e of graph.edges)
        if (reached.has(e.source)) reached.add(e.target);
    for (const node of graph.nodes)
      if (!reached.has(node.id))
        errors.push(`${node.label} is disconnected from the trigger.`);
  }
  for (const node of graph.nodes) {
    const c = node.config;
    const needed: Partial<Record<typeof node.kind, string[]>> = {
      agent: ["agentId"],
      customTool: ["agentId"],
      gemini: ["model", "prompt"],
      http: ["url"],
      telegram: ["credentialId", "chatId", "text"],
      email: ["credentialId", "to", "subject", "text"],
      x: ["credentialId", "text"],
      telegramTrigger: ["credentialId"],
      emailTrigger: ["credentialId"],
      xTrigger: ["credentialId"],
    };
    for (const key of needed[node.kind] ?? [])
      if (typeof c[key] !== "string" || !(c[key] as string).trim())
        errors.push(`${node.label}: ${key} is required.`);
    if (
      node.kind === "transform" &&
      (!c.values || typeof c.values !== "object" || Array.isArray(c.values))
    )
      errors.push(`${node.label}: values must be an object.`);
    if (
      node.kind === "router" &&
      (!c.cases ||
        typeof c.cases !== "object" ||
        Array.isArray(c.cases) ||
        Object.keys(c.cases).some(
          (k) => k === "default" || !/^[\w-]+$/.test(k),
        ))
    )
      errors.push(
        `${node.label}: cases must be an object with named routes other than default.`,
      );
    if (
      node.kind === "condition" &&
      ![
        "equals",
        "notEquals",
        "contains",
        "greaterThan",
        "lessThan",
        "exists",
      ].includes(String(c.operator))
    )
      errors.push(`${node.label}: invalid condition operator.`);
    if (
      node.kind === "http" &&
      !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(String(c.method))
    )
      errors.push(`${node.label}: invalid HTTP method.`);
    if (
      ["http", "telegram", "email", "x", "agent"].includes(node.kind) &&
      node.retry.attempts > 1
    )
      errors.push(
        `${node.label}: automatic retries are disabled for nodes that may have external side effects.`,
      );
  }
  return [...new Set(errors)];
}
export function topologicalOrder(graph: WorkflowGraph): string[] {
  const pending = new Map(graph.nodes.map((n) => [n.id, 0]));
  for (const e of graph.edges)
    pending.set(e.target, (pending.get(e.target) ?? 0) + 1);
  const ready = [...pending].filter(([, v]) => v === 0).map(([id]) => id),
    order: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const e of graph.edges.filter((e) => e.source === id)) {
      const count = pending.get(e.target)! - 1;
      pending.set(e.target, count);
      if (count === 0) ready.push(e.target);
    }
  }
  if (order.length !== graph.nodes.length) throw new Error("Cycle detected");
  return order;
}
const forbidden = new Set(["__proto__", "constructor", "prototype"]);
export function readPath(value: unknown, path: string): unknown {
  if (!path) return value;
  let result = value;
  for (const key of path.split(".")) {
    if (forbidden.has(key)) throw new Error("Unsafe reference path");
    if (
      result === null ||
      typeof result !== "object" ||
      !Object.hasOwn(result, key)
    )
      throw new Error(`Reference not found: ${path}`);
    result = (result as Record<string, unknown>)[key];
  }
  return result;
}
export function resolveBindings(
  value: unknown,
  context: {
    input: unknown;
    trigger: unknown;
    nodes: Record<string, unknown>;
  },
): unknown {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{\s*([\w.-]+)\s*\}\}$/);
    if (exact) return readPath(context, exact[1]);
    return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, path) => {
      const v = readPath(context, path);
      return typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    });
  }
  if (Array.isArray(value))
    return value.map((v) => resolveBindings(v, context));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => {
        if (forbidden.has(k)) throw new Error("Unsafe object key");
        return [k, resolveBindings(v, context)];
      }),
    );
  return value;
}
