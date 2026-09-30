import { describe, it, expect } from "vitest";
import { validateOutput, buildRepairPrompt } from "@/lib/runtime/outputValidator";

describe("validateOutput", () => {
  it("accepts valid JSON", () => {
    const result = validateOutput('{"name":"Alice","age":30}', "json", JSON.stringify({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    }));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid JSON", () => {
    const result = validateOutput("not json", "json", "{}");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid JSON");
  });

  it("strips markdown code fences", () => {
    const result = validateOutput('```json\n{"key":"value"}\n```', "json", "{}");
    expect(result.valid).toBe(true);
  });

  it("validates required fields", () => {
    const result = validateOutput('{"name":"Alice"}', "json", JSON.stringify({
      type: "object",
      properties: { name: { type: "string" }, age: { type: "number" } },
      required: ["name", "age"],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("age"))).toBe(true);
  });

  it("passes text format always", () => {
    const result = validateOutput("any text", "text", "{}");
    expect(result.valid).toBe(true);
  });
});

describe("buildRepairPrompt", () => {
  it("includes errors in prompt", () => {
    const prompt = buildRepairPrompt('{"x":1}', ["Missing required field: y"]);
    expect(prompt).toContain("Missing required field: y");
  });
});
