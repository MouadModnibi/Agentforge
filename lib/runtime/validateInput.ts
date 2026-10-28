import type { InputParam } from "@/lib/schemas/agent";
export function validateInput(
  params: InputParam[],
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const input = { ...raw };
  for (const param of params) {
    let value = input[param.name];
    if (value === undefined && param.default !== undefined) {
      try {
        value = ["number", "boolean", "json"].includes(param.type)
          ? JSON.parse(param.default)
          : param.default;
      } catch {
        throw new Error(`Invalid default for ${param.name}`);
      }
      input[param.name] = value;
    }
    if (value === undefined) {
      if (param.required)
        throw new Error(`Missing required input: ${param.name}`);
      continue;
    }
    const valid =
      param.type === "json"
        ? value !== undefined
        : param.type === "number"
          ? typeof value === "number" && Number.isFinite(value)
          : param.type === "file"
            ? typeof value === "string"
            : typeof value === param.type;
    if (!valid) throw new Error(`Input ${param.name} must be ${param.type}`);
  }
  return input;
}
