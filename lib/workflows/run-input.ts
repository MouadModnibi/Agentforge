import type { WorkflowGraph } from "./schema";
export type RunInputMode = "text" | "json";

export function defaultRunInputMode(graph: WorkflowGraph): RunInputMode {
  if (!graph.nodes.some((node) => node.kind === "manual")) return "json";
  const fields = new Set(
    Array.from(
      JSON.stringify(graph).matchAll(/\{\{\s*(?:trigger|input)\.([\w-]+)/g),
      (match) => match[1],
    ),
  );
  return fields.size === 1 && fields.has("text") ? "text" : "json";
}

export function parseRunInput(
  source: string,
  mode: RunInputMode,
): Record<string, unknown> {
  if (mode === "text") {
    if (!source.trim())
      throw new Error("Paste a job description or message first.");
    return { text: source };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(
      "Invalid JSON. Choose Plain text to paste a job description, or correct the JSON formatting.",
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error('JSON input must be an object, such as {"text":"Hello"}.');
  return parsed as Record<string, unknown>;
}
