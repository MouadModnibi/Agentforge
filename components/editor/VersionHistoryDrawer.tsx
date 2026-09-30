"use client";
import { useState } from "react";
import { History, RotateCcw, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";
import type { AgentConfig, CustomTool, ExternalApi } from "@/lib/schemas/agent";

interface Version {
  id: string;
  agentId: string;
  version: number;
  snapshot: string; // JSON
  createdAt: number;
}

interface AgentSnapshot {
  name: string;
  description: string;
  status: "draft" | "active";
  config: AgentConfig;
  customTool: CustomTool | null;
  externalApis: ExternalApi[];
}

interface Props {
  agentId: string;
  open: boolean;
  onClose: () => void;
  onRestore: (snapshot: AgentSnapshot) => void;
}

export function VersionHistoryDrawer({ agentId, open, onClose, onRestore }: Props) {
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [restoring, setRestoring] = useState(false);

  const { data: versions, isLoading } = useQuery<Version[]>({
    queryKey: ["versions", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/versions`);
      const json = await res.json() as { data: Version[]; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to load versions");
      return json.data;
    },
    enabled: open && !!agentId,
  });

  function handleRestore(version: Version) {
    setRestoring(true);
    try {
      const snapshot = JSON.parse(version.snapshot) as AgentSnapshot;
      onRestore(snapshot);
      toast.success(`Restored to version ${version.version}`);
      onClose();
    } catch {
      toast.error("Failed to parse version snapshot");
    } finally {
      setRestoring(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 z-50 h-full w-80 border-l bg-background shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Version history</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <p className="px-4 py-2 text-xs text-muted-foreground border-b">
          A new version is saved every time you save the agent. Click any version to preview, then restore it.
        </p>

        <ScrollArea className="flex-1">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (!versions || versions.length === 0) && (
            <div className="py-12 text-center text-sm text-muted-foreground px-4">
              No saved versions yet. Save the agent to create the first version.
            </div>
          )}

          {versions && versions.length > 0 && (
            <div className="py-2">
              {versions.map((v, i) => {
                const isSelected = selectedVersion?.id === v.id;
                let snapshot: AgentSnapshot | null = null;
                try { snapshot = JSON.parse(v.snapshot) as AgentSnapshot; } catch { /* ignore */ }

                return (
                  <div key={v.id}>
                    <button
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${isSelected ? "bg-muted" : ""}`}
                      onClick={() => setSelectedVersion(isSelected ? null : v)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">v{v.version}</span>
                          {i === 0 && (
                            <Badge variant="secondary" className="text-[10px]">latest</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(new Date(v.createdAt))}
                        </span>
                      </div>
                      {snapshot && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {snapshot.name} · {snapshot.config?.model ?? "unknown model"}
                        </p>
                      )}
                    </button>

                    {isSelected && snapshot && (
                      <div className="mx-4 mb-3 p-3 rounded-md bg-muted/50 border text-xs space-y-1.5">
                        <div className="font-medium">{snapshot.name}</div>
                        {snapshot.description && (
                          <div className="text-muted-foreground">{snapshot.description}</div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px]">{snapshot.config?.model}</Badge>
                          <Badge variant={snapshot.status === "active" ? "success" : "secondary"} className="text-[10px]">
                            {snapshot.status}
                          </Badge>
                          {snapshot.config?.inputParams?.length > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {snapshot.config.inputParams.length} input{snapshot.config.inputParams.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="mt-2 w-full"
                          disabled={restoring}
                          onClick={() => handleRestore(v)}
                        >
                          {restoring ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Restore this version
                        </Button>
                      </div>
                    )}
                    {i < versions.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </aside>
    </>
  );
}
