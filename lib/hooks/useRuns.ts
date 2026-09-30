"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Run } from "@/lib/schemas/run";

interface ApiResponse<T> { data: T; }

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = json as { error?: { message?: string } };
    throw new Error(err.error?.message || "Request failed");
  }
  return (json as ApiResponse<T>).data;
}

export function useRuns(agentId: string) {
  return useQuery<Run[]>({
    queryKey: ["runs", agentId],
    queryFn: () => apiFetch<Run[]>(`/api/agents/${agentId}/runs`),
    enabled: !!agentId,
  });
}

export interface PlaygroundRunResult {
  output: unknown;
  valid: boolean;
  trace: unknown[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  llmRequestCount: number;
  durationMs: number;
  error?: string;
  runId: string;
}

export function usePlaygroundRun() {
  return useMutation({
    mutationFn: async (payload: { agentId: string; input: Record<string, unknown> }): Promise<PlaygroundRunResult> => {
      const res = await fetch("/api/playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = json as { error?: { message?: string } };
        throw new Error(err.error?.message || "Run failed");
      }
      return (json as ApiResponse<PlaygroundRunResult>).data;
    },
  });
}
