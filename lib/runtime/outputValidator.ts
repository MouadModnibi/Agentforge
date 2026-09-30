export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsed?: unknown;
}

function validateAgainstSchema(data: unknown, schema: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!schema || Object.keys(schema).length === 0) return errors;

  if (schema.type === "object" && typeof data !== "object") {
    errors.push(`Expected object, got ${typeof data}`);
    return errors;
  }

  if (schema.type === "array" && !Array.isArray(data)) {
    errors.push(`Expected array, got ${typeof data}`);
    return errors;
  }

  if (schema.properties && typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const required = (schema.required as string[]) || [];

    for (const key of required) {
      if (!(key in obj)) {
        errors.push(`Missing required field: ${key}`);
      }
    }

    const properties = schema.properties as Record<string, Record<string, unknown>>;
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in obj && propSchema.type) {
        const actualType = Array.isArray(obj[key]) ? "array" : typeof obj[key];
        if (actualType !== propSchema.type && obj[key] !== null) {
          errors.push(`Field ${key}: expected ${propSchema.type}, got ${actualType}`);
        }
      }
    }
  }

  return errors;
}

export function validateOutput(
  rawOutput: string,
  format: "json" | "text" | "markdown",
  schemaStr: string
): ValidationResult {
  if (format === "text" || format === "markdown") {
    return { valid: true, errors: [], parsed: rawOutput };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    // Strip markdown code blocks if present
    let cleaned = rawOutput.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
      const end = cleaned.lastIndexOf("```");
      if (end > -1) cleaned = cleaned.slice(0, end);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
      const end = cleaned.lastIndexOf("```");
      if (end > -1) cleaned = cleaned.slice(0, end);
    }
    parsed = JSON.parse(cleaned.trim());
  } catch (err) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // Validate against schema
  let schema: Record<string, unknown> = {};
  try {
    schema = JSON.parse(schemaStr || "{}");
  } catch {
    // ignore schema parse errors
  }

  const errors = validateAgainstSchema(parsed, schema);
  return { valid: errors.length === 0, errors, parsed };
}

export function buildRepairPrompt(originalOutput: string, errors: string[]): string {
  return `Your previous response had the following validation errors:\n${errors.map((e) => `- ${e}`).join("\n")}\n\nOriginal response:\n${originalOutput}\n\nPlease fix the JSON to match the required schema. Respond with ONLY the corrected JSON, no other text.`;
}
