import { z } from "zod";

export const RunSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  source: z.enum(["playground", "api"]),
  input: z.record(z.string(), z.unknown()),
  output: z.unknown().nullable(),
  valid: z.boolean().nullable(),
  trace: z.array(z.unknown()).nullable(),
  usage: z.object({
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }).nullable(),
  llmRequestCount: z.number().int(),
  durationMs: z.number().int().nullable(),
  error: z.string().nullable(),
  createdAt: z.date(),
});

export const RunRequestSchema = z.object({
  input: z.record(z.string(), z.unknown()),
  apiKey: z.string().optional(),
});

export type Run = z.infer<typeof RunSchema>;
export type RunRequest = z.infer<typeof RunRequestSchema>;
