"use client";
import { useQuery } from "@tanstack/react-query";
import type {
  Workflow,
  WorkflowRun,
  CredentialSummary,
} from "@/lib/workflows/schema";
export async function workflowFetch<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message ?? "Request failed");
  return j.data as T;
}
export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: () =>
      workflowFetch<{
        workflows: Workflow[];
        workerOnline: boolean;
        runtime: string;
        schedulerHealthy: boolean;
        schedulerLastTick: number | null;
      }>("/api/workflows"),
    refetchInterval: 5000,
  });
}
export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ["workflow", id],
    queryFn: () => workflowFetch<Workflow>(`/api/workflows/${id}`),
  });
}
export function useWorkflowRuns(id: string) {
  return useQuery({
    queryKey: ["workflow-runs", id],
    queryFn: () => workflowFetch<WorkflowRun[]>(`/api/workflows/${id}/runs`),
    refetchInterval: 1500,
  });
}
export function useCredentials() {
  return useQuery({
    queryKey: ["workflow-credentials"],
    queryFn: () =>
      workflowFetch<CredentialSummary[]>("/api/workflow-credentials"),
  });
}
