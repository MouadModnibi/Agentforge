import { z } from "zod";

export const InputParamSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name required"),
  type: z.enum(["string", "number", "boolean", "json", "file"]),
  required: z.boolean().default(true),
  default: z.string().optional(),
  description: z.string().optional(),
});

export const ExternalApiSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  baseUrl: z.string().url("Must be a valid URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string(), z.string()).default({}),
  queryTemplate: z.string().optional(),
  bodyTemplate: z.string().optional(),
  description: z.string().optional(),
  secretKeys: z.array(z.string()).default([]),
});

export const CustomToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameterSchema: z.string().default("{}"),
  code: z.string().min(1),
});

export const AgentConfigSchema = z.object({
  model: z.string().default("gemini-3.8-flash"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(8192).default(2048),
  systemPrompt: z.string().default(""),
  inputParams: z.array(InputParamSchema).default([]),
  outputFormat: z.enum(["json", "text", "markdown"]).default("json"),
  outputSchema: z.string().default("{}"),
  strictValidation: z.boolean().default(false),
  maxIterations: z.number().int().min(1).max(10).default(3),
  repairRetries: z.number().int().min(0).max(2).default(1),
  timeoutMs: z.number().int().min(1000).max(300000).default(30000),
});

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).default(""),
  status: z.enum(["draft", "active"]).default("draft"),
  schemaVersion: z.number().int().default(1),
  config: AgentConfigSchema,
  customTool: CustomToolSchema.nullable().default(null),
  externalApis: z.array(ExternalApiSchema).default([]),
  apiKeyHash: z.string().nullable().default(null),
  runsCount: z.number().int().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateAgentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).default(""),
  status: z.enum(["draft", "active"]).default("draft"),
  config: AgentConfigSchema.partial().optional(),
  customTool: CustomToolSchema.nullable().optional(),
  externalApis: z.array(ExternalApiSchema).optional(),
});

export const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["draft", "active"]).optional(),
  config: AgentConfigSchema.partial().optional(),
  customTool: CustomToolSchema.nullable().optional(),
  externalApis: z.array(ExternalApiSchema).optional(),
});

export type Agent = z.infer<typeof AgentSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type InputParam = z.infer<typeof InputParamSchema>;
export type ExternalApi = z.infer<typeof ExternalApiSchema>;
export type CustomTool = z.infer<typeof CustomToolSchema>;
export type CreateAgent = z.infer<typeof CreateAgentSchema>;
export type UpdateAgent = z.infer<typeof UpdateAgentSchema>;
