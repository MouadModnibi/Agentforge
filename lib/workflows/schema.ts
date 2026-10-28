import { z } from "zod";
export const nodeKinds = [
  "manual",
  "formTrigger",
  "webhook",
  "telegramTrigger",
  "emailTrigger",
  "xTrigger",
  "agent",
  "gemini",
  "condition",
  "router",
  "transform",
  "http",
  "customTool",
  "telegram",
  "email",
  "x",
] as const;
export type NodeKind = (typeof nodeKinds)[number];
export const NodeSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  kind: z.enum(nodeKinds),
  label: z.string().min(1).max(100),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  config: z.record(z.string(), z.unknown()).default({}),
  retry: z
    .object({
      attempts: z.number().int().min(1).max(3).default(1),
      delayMs: z.number().int().min(100).max(30000).default(1000),
    })
    .default({ attempts: 1, delayMs: 1000 }),
  timeoutMs: z.number().int().min(100).max(300000).default(30000),
});
export const EdgeSchema = z.object({
  id: z.string().min(1).max(100),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().default("out"),
});
export const GraphSchema = z.object({
  nodes: z.array(NodeSchema).min(1).max(100),
  edges: z.array(EdgeSchema).max(300),
});
export const WorkflowInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).default(""),
  graph: GraphSchema,
  revision: z.number().int().positive().optional(),
});
export type WorkflowNode = z.infer<typeof NodeSchema>;
export type WorkflowEdge = z.infer<typeof EdgeSchema>;
export type WorkflowGraph = z.infer<typeof GraphSchema>;
export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
export interface Workflow {
  id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
  revision: number;
  activeRevision: number | null;
  createdAt: number;
  updatedAt: number;
}
export const runStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
] as const;
export type RunStatus = (typeof runStatuses)[number];
export interface NodeRun {
  nodeId: string;
  label: string;
  kind: NodeKind;
  status:
    "pending" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";
  input?: unknown;
  output?: unknown;
  error?: string;
  attempt: number;
  startedAt?: number;
  finishedAt?: number;
  branch?: string;
  usage?: Record<string, number>;
}
export interface WorkflowRun {
  id: string;
  workflowId: string;
  revision: number;
  graph: WorkflowGraph;
  status: RunStatus;
  source: string;
  input: Record<string, unknown>;
  steps: NodeRun[];
  output: unknown;
  error: string | null;
  retryOf: string | null;
  cancelRequested: boolean;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  leaseUntil: number | null;
}
export const CredentialInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["telegram", "email", "x", "http"]),
  values: z.record(z.string(), z.string().max(8192)),
});
export type CredentialInput = z.infer<typeof CredentialInputSchema>;
export interface CredentialSummary {
  id: string;
  name: string;
  kind: CredentialInput["kind"];
  createdAt: number;
}
