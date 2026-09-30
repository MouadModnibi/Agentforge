"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit, Play, Copy, Download, Trash2, MoreHorizontal, Link, CheckCircle, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteAgent, useDuplicateAgent } from "@/lib/hooks/useAgents";
import { formatRelative, copyToClipboard } from "@/lib/utils";
import type { Agent } from "@/lib/schemas/agent";
import { toast } from "sonner";

export function AgentTable({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const deleteAgent = useDeleteAgent();
  const duplicateAgent = useDuplicateAgent();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleExport(agent: Agent) {
    const data = {
      name: agent.name,
      description: agent.description,
      config: agent.config,
      customTool: agent.customTool,
      // externalApis excluded (may contain secrets)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agent.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Agent exported");
  }

  function handleCopyEndpoint(agent: Agent) {
    const url = `${window.location.origin}/api/agents/${agent.id}/run`;
    copyToClipboard(url).then(() => toast.success("API endpoint copied"));
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Model</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Runs</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Updated</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.id}
                className="border-b last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3">
                  <div>
                    <button
                      onClick={() => router.push(`/agents/${agent.id}/edit`)}
                      className="font-medium hover:text-primary transition-colors text-left"
                    >
                      {agent.name}
                    </button>
                    {agent.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                        {agent.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {agent.config.model}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <Badge variant={agent.status === "active" ? "success" : "secondary"}>
                    {agent.status === "active" ? (
                      <><CheckCircle className="w-3 h-3 mr-1" />Active</>
                    ) : (
                      <><Clock className="w-3 h-3 mr-1" />Draft</>
                    )}
                  </Badge>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                  {agent.runsCount}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                  {formatRelative(agent.updatedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => router.push(`/agents/${agent.id}/playground`)}
                      title="Open playground"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => router.push(`/agents/${agent.id}/edit`)}
                      title="Edit agent"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopyEndpoint(agent)}>
                          <Link className="w-4 h-4 mr-2" /> Copy API endpoint
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateAgent.mutate(agent.id)}>
                          <Copy className="w-4 h-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(agent)}>
                          <Download className="w-4 h-4 mr-2" /> Export JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(agent.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the agent and all its runs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  deleteAgent.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
