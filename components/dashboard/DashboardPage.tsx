"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, LayoutGrid, List, Plus, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentTable } from "./AgentTable";
import { ImportAgentDialog } from "./ImportAgentDialog";
import { CollectionPagination } from "@/components/ui/collection-pagination";
import { useCollectionState } from "@/lib/hooks/useCollectionState";
import { WorkspaceArtwork } from "@/components/WorkspaceArtwork";
import { useAgents } from "@/lib/hooks/useAgents";

export function DashboardPage() {
  const router = useRouter();
  const searchInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useCollectionState("agents.page", 1);
  const [search, setSearch] = useCollectionState("agents.search", "");
  const [statusFilter, setStatusFilter] = useCollectionState<
    "all" | "draft" | "active"
  >("agents.filter", "all");
  const [sort, setSort] = useCollectionState("agents.sort", "recent");
  const [view, setView] = useCollectionState<"grid" | "list">(
    "agents.view",
    "grid",
  );
  const [importOpen, setImportOpen] = useState(false);
  const {
    data: agents = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useAgents();
  const filtered = agents
    .filter(
      (agent) =>
        (statusFilter === "all" || agent.status === statusFilter) &&
        `${agent.name} ${agent.description} ${agent.config.model}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "runs"
          ? b.runsCount - a.runsCount
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const activeCount = agents.filter(
    (agent) => agent.status === "active",
  ).length;
  const runCount = agents.reduce((sum, agent) => sum + agent.runsCount, 0);

  return (
    <main className="forge-dashboard">
      <div className="forge-page-heading m4m-illustrated-heading">
        <div>
          <h1>Agents</h1>
          <p>
            {isLoading
              ? "Loading agents…"
              : isError
                ? "Manage agent configurations."
                : `${agents.length} agents · ${activeCount} active · ${runCount.toLocaleString()} runs`}
          </p>
        </div>
        <WorkspaceArtwork variant="agents" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Import
          </Button>
          <Button asChild>
            <Link href="/agents/new">
              <Plus />
              New agent
            </Link>
          </Button>
        </div>
      </div>
      <section
        aria-labelledby="agents-heading"
        className="forge-agents-section"
      >
        <h2 id="agents-heading" className="sr-only">
          Agent list
        </h2>
        <div className="forge-filterbar">
          <div
            className="forge-status-tabs"
            aria-label="Filter agents by status"
          >
            {(["all", "active", "draft"] as const).map((status) => (
              <button
                key={status}
                aria-pressed={statusFilter === status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={statusFilter === status ? "is-active" : ""}
              >
                {status === "all"
                  ? "All agents"
                  : status === "active"
                    ? "Active"
                    : "Drafts"}
              </button>
            ))}
          </div>
          <div className="forge-filter-controls">
            <div className="relative min-w-0 flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={15}
              />
              <Input
                ref={searchInput}
                aria-label="Search agents"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 pr-8 h-9"
              />
              {search && (
                <button
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                    searchInput.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Select
              value={sort}
              onValueChange={(v) => {
                setSort(v);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Sort agents" className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Last updated</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="runs">Most runs</SelectItem>
              </SelectContent>
            </Select>
            <div className="forge-view-toggle">
              <button
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className={view === "grid" ? "is-active" : ""}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                aria-label="List view"
                aria-pressed={view === "list"}
                className={view === "list" ? "is-active" : ""}
                onClick={() => setView("list")}
              >
                <List size={17} />
              </button>
            </div>
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-2" aria-label="Loading agents">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <div className="forge-empty">
            <span className="forge-empty-icon">
              <Bot />
            </span>
            <h3>We couldn’t load your agents</h3>
            <p>Check your connection and try again.</p>
            <Button
              variant="outline"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </div>
        ) : agents.length === 0 ? (
          <div className="forge-empty">
            <Bot size={24} className="mb-3 text-muted-foreground" />
            <h3>No agents yet</h3>
            <p>
              Create an agent to configure its model, instructions, and tools.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/agents/new")}
            >
              <Plus size={15} />
              New agent
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="forge-empty">
            <span className="forge-empty-icon">
              <Search />
            </span>
            <h3>No matching agents</h3>
            <p>Try a different search or clear your filters.</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <AgentTable
            agents={filtered.slice((currentPage - 1) * 12, currentPage * 12)}
            view={view}
          />
        )}
      </section>
      <CollectionPagination
        page={currentPage}
        pages={pages}
        onChange={setPage}
      />
      <ImportAgentDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </main>
  );
}
