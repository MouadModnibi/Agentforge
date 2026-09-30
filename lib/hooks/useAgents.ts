"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Agent, CreateAgent, UpdateAgent } from "@/lib/schemas/agent";

interface ApiResponse<T> { data: T; }
interface ErrorResponse { error: { code: string; message: string; details?: unknown } }

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = json as ErrorResponse;
    throw new Error(err.error?.message || "Request failed");
  }
  return (json as ApiResponse<T>).data;
}

export function useAgents(search?: string, status?: "draft" | "active") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const qs = params.toString();

  return useQuery<Agent[]>({
    queryKey: ["agents", search, status],
    queryFn: () => apiFetch<Agent[]>(`/api/agents${qs ? `?${qs}` : ""}`),
  });
}

export function useAgent(id: string) {
  return useQuery<Agent>({
    queryKey: ["agents", id],
    queryFn: () => apiFetch<Agent>(`/api/agents/${id}`),
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgent) =>
      apiFetch<Agent>("/api/agents", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAgent }) =>
      apiFetch<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.setQueryData(["agents", agent.id], agent);
      toast.success("Agent saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/agents/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["agents"] });
      const prev = qc.getQueryData<Agent[]>(["agents"]);
      qc.setQueryData<Agent[]>(["agents"], (old) => old?.filter((a) => a.id !== id) ?? []);
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["agents"], ctx.prev);
      toast.error("Failed to delete agent");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent deleted");
    },
  });
}

export function useDuplicateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Agent>(`/api/agents/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent duplicated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
