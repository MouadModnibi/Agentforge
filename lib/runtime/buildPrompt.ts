import type { AgentConfig, InputParam } from "@/lib/schemas/agent";

export interface BuildPromptOptions {
  config: AgentConfig;
  input: Record<string, unknown>;
  resources: Array<{ name: string; content: string; mimeType: string; id?: string; size?: number }>;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userMessage: string;
  estimatedTokens: number;
}

function interpolateVariables(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
  });
}

function buildOutputInstructions(config: AgentConfig): string {
  if (config.outputFormat === "json") {
    const schema = (() => {
      try { return JSON.parse(config.outputSchema); } catch { return {}; }
    })();
    if (Object.keys(schema).length > 0) {
      return `\n\nOUTPUT REQUIREMENTS:\nRespond with ONLY valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nDo not include any text outside the JSON object.`;
    }
    return "\n\nOUTPUT REQUIREMENTS:\nRespond with ONLY valid JSON. Do not include any text outside the JSON.";
  }
  if (config.outputFormat === "markdown") {
    return "\n\nOUTPUT REQUIREMENTS:\nFormat your response as Markdown.";
  }
  return "";
}

export function buildPrompt(opts: BuildPromptOptions): BuiltPrompt {
  const { config, input, resources } = opts;

  let systemPrompt = interpolateVariables(config.systemPrompt || "", input);
  systemPrompt += buildOutputInstructions(config);

  // Inject resources as labeled blocks
  if (resources.length > 0) {
    systemPrompt += "\n\n## Context Resources\n";
    for (const resource of resources) {
      systemPrompt += `\n### Resource: ${resource.name}\n\`\`\`\n${resource.content}\n\`\`\`\n`;
    }
  }

  // Build user message from input params
  const inputLines = Object.entries(input)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("\n");

  const userMessage = inputLines || "Process the request according to the system instructions.";

  // Rough token estimate (4 chars per token)
  const estimatedTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);

  return { systemPrompt, userMessage, estimatedTokens };
}

export function buildInputSchema(params: InputParam[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of params) {
    const typeMap: Record<string, string> = {
      string: "string",
      number: "number",
      boolean: "boolean",
      json: "object",
      file: "string",
    };

    properties[param.name] = {
      type: typeMap[param.type] || "string",
      description: param.description || "",
      ...(param.default !== undefined ? { default: param.default } : {}),
    };

    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: true,
  };
}
