"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit,
  Play,
  Copy,
  Download,
  Trash2,
  MoreHorizontal,
  Link,
  Bot,
  ArrowUpRight,
  Activity,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteAgent, useDuplicateAgent } from "@/lib/hooks/useAgents";
import { formatRelative, copyToClipboard } from "@/lib/utils";
import type { Agent } from "@/lib/schemas/agent";
import { toast } from "sonner";
import styles from "./AgentTable.module.css";

export function AgentTable({
  agents,
  view = "list",
}: {
  agents: Agent[];
  view?: "grid" | "list";
}) {
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
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
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
    copyToClipboard(url)
      .then(() => toast.success("API endpoint copied"))
      .catch(() => toast.error("Could not copy the endpoint"));
  }

  return (
    <>
      {view === "grid" ? (
        <div className="forge-agent-grid">
          {agents.map((agent) => (
            <article
              key={agent.id}
              className={`forge-agent-card ${styles.card}`}
            >
              <div className="flex items-center justify-between">
                <span className={`forge-agent-icon ${styles.icon}`}>
                  <Bot size={23} strokeWidth={1.7} />
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      agent.status === "active" ? "success" : "secondary"
                    }
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full mr-1.5 ${agent.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`}
                    />
                    {agent.status === "active" ? "Active" : "Draft"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Actions for ${agent.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/agents/${agent.id}/edit`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit agent
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCopyEndpoint(agent)}
                      >
                        <Link className="w-4 h-4 mr-2" />
                        Copy API endpoint
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={duplicateAgent.isPending}
                        onClick={() => duplicateAgent.mutate(agent.id)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(agent)}>
                        <Download className="w-4 h-4 mr-2" />
                        Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(agent.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <button
                className="forge-agent-title"
                onClick={() => router.push(`/agents/${agent.id}/edit`)}
              >
                {agent.name}
                <ArrowUpRight size={15} />
              </button>
              <p className="forge-agent-description">
                {agent.description || "No description"}
              </p>
              <div className="m4m-agent-instructions">
                <span>Instructions</span>
                <p>
                  {agent.config.systemPrompt ||
                    "No instructions configured yet."}
                </p>
              </div>
              <div className="forge-agent-model">
                <Cpu size={12} />
                <span>{agent.config.model}</span>
                <span className="ml-auto uppercase text-[10px]">
                  {agent.config.outputFormat}
                </span>
              </div>
              <div className="forge-agent-card-footer">
                <span>
                  <Activity size={12} />
                  {agent.runsCount.toLocaleString()} runs
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => router.push(`/agents/${agent.id}/playground`)}
                >
                  <Play size={12} />
                  Test agent
                </Button>
              </div>
            </article>
          ))}
          <button
            className="forge-new-agent-card"
            onClick={() => router.push("/agents/new")}
          >
            <span>+</span>
            <strong>Add agent</strong>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border-y border-border/70">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/70 text-xs">
                <th
                  scope="col"
                  className="text-left px-3 py-2.5 font-medium text-muted-foreground"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell"
                >
                  Model
                </th>
                <th
                  scope="col"
                  className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell"
                >
                  Runs
                </th>
                <th
                  scope="col"
                  className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell"
                >
                  Updated
                </th>
                <th
                  scope="col"
                  className="text-right px-3 py-2.5 font-medium text-muted-foreground"
                >
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2.5">
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
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {agent.config.model}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${agent.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/60"}`}
                      />
                      {agent.status === "active" ? "Active" : "Draft"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground tabular-nums">
                    {agent.runsCount}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground text-xs">
                    {formatRelative(agent.updatedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() =>
                          router.push(`/agents/${agent.id}/playground`)
                        }
                        title="Open playground"
                        aria-label={`Test ${agent.name}`}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => router.push(`/agents/${agent.id}/edit`)}
                        title="Edit agent"
                        aria-label={`Edit ${agent.name}`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            aria-label={`Actions for ${agent.name}`}
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleCopyEndpoint(agent)}
                          >
                            <Link className="w-4 h-4 mr-2" /> Copy API endpoint
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => duplicateAgent.mutate(agent.id)}
                          >
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
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the agent and all its runs. This
              action cannot be undone.
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
