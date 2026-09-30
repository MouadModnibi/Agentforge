"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Bot, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentTable } from "./AgentTable";
import { EmptyState } from "./EmptyState";
import { ImportAgentDialog } from "./ImportAgentDialog";
import { useAgents, useCreateAgent } from "@/lib/hooks/useAgents";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function DashboardPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active">("all");
  const [importOpen, setImportOpen] = useState(false);

  const { data: agents, isLoading } = useAgents(
    search || undefined,
    statusFilter !== "all" ? statusFilter : undefined
  );
  const createAgent = useCreateAgent();

  async function handleCreateNew() {
    router.push("/agents/new");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">AgentForge</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex items-center gap-2 text-muted-foreground"
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
              }}
              aria-label="Open command palette"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs">Search</span>
              <kbd className="ml-1 text-[10px] border rounded px-1">⌘K</kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" />
              Import JSON
            </Button>
            <Button size="sm" onClick={handleCreateNew}>
              <Plus className="w-4 h-4" />
              New agent
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Build, test and deploy AI agents powered by Gemini.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-36">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : !agents || agents.length === 0 ? (
          <EmptyState onCreateNew={handleCreateNew} />
        ) : (
          <AgentTable agents={agents} />
        )}
      </main>

      <ImportAgentDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
