import { describe, it, expect } from "vitest";
import { buildPrompt, buildInputSchema } from "@/lib/runtime/buildPrompt";
import type { AgentConfig } from "@/lib/schemas/agent";

const baseConfig: AgentConfig = {
  model: "gemini-2.0-flash",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: "You are a helper. User name: {{name}}",
  inputParams: [],
  outputFormat: "json",
  outputSchema: "{}",
  strictValidation: false,
  maxIterations: 3,
  repairRetries: 1,
  timeoutMs: 30000,
};

describe("buildPrompt", () => {
  it("interpolates variables", () => {
    const result = buildPrompt({
      config: baseConfig,
      input: { name: "Alice" },
      resources: [],
    });
    expect(result.systemPrompt).toContain("Alice");
  });

  it("adds JSON output instructions", () => {
    const result = buildPrompt({
      config: baseConfig,
      input: {},
      resources: [],
    });
    expect(result.systemPrompt).toContain("JSON");
  });

  it("injects resources", () => {
    const result = buildPrompt({
      config: baseConfig,
      input: {},
      resources: [{ name: "doc.txt", content: "hello world", mimeType: "text/plain", id: "1", size: 11 }],
    });
    expect(result.systemPrompt).toContain("doc.txt");
    expect(result.systemPrompt).toContain("hello world");
  });
});

describe("buildInputSchema", () => {
  it("generates JSON schema from params", () => {
    const schema = buildInputSchema([
      { id: "1", name: "text", type: "string", required: true },
      { id: "2", name: "count", type: "number", required: false },
    ]);
    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, unknown>).text).toBeDefined();
    expect((schema.required as string[])).toContain("text");
    expect((schema.required as string[])).not.toContain("count");
  });
});
