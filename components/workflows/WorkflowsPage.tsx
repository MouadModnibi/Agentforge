"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronRight,
  Copy,
  Download,
  FileStack,
  GitBranch,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { templates } from "@/lib/workflows/templates";
import { WorkflowInputSchema, type Workflow } from "@/lib/workflows/schema";
import { useWorkflows, workflowFetch } from "@/lib/hooks/useWorkflows";
import { WorkflowRouteStrip } from "@/components/workflows/WorkflowRouteStrip";
import { useConfirmAction } from "@/components/ui/confirm-action";
import { CollectionPagination } from "@/components/ui/collection-pagination";
import { useCollectionState } from "@/lib/hooks/useCollectionState";
import { WorkspaceArtwork } from "@/components/WorkspaceArtwork";
import "@/app/workflow-overview.css";

type WorkflowFilter = "all" | "active" | "draft";

export function WorkflowsPage() {
  const { data, isLoading, error, refetch } = useWorkflows();
  const [search, setSearch] = useCollectionState("workflows.search", "");
  const [filter, setFilter] = useCollectionState<WorkflowFilter>(
    "workflows.filter",
    "all",
  );
  const [view, setView] = useCollectionState<"gallery" | "list">(
    "workflows.view",
    "gallery",
  );
  const [creating, setCreating] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const confirmAction = useConfirmAction();
  const searchInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useCollectionState("workflows.page", 1);
  const qc = useQueryClient();
  const workflows = data?.workflows ?? [];
  const query = search.trim().toLowerCase();
  const activeCount = workflows.filter(
    (workflow) => workflow.activeRevision,
  ).length;
  const visible = workflows.filter(
    (workflow) =>
      `${workflow.name} ${workflow.description ?? ""}`
        .toLowerCase()
        .includes(query) &&
      (filter === "all" ||
        (filter === "active"
          ? !!workflow.activeRevision
          : !workflow.activeRevision)),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 12));
  const currentPage = Math.min(page, pages);
  const paged = visible.slice((currentPage - 1) * 12, currentPage * 12);
  const isCreating = !!creating || importing;

  async function create(templateId: string) {
    setCreating(templateId);
    try {
      const template = templates.find((item) => item.id === templateId)!;
      const workflow = await workflowFetch<Workflow>("/api/workflows", "POST", {
        name: template.id === "starter" ? "Untitled workflow" : template.name,
        description: template.description,
        graph: template.graph,
      });
      qc.invalidateQueries({ queryKey: ["workflows"] });
      router.push(`/workflows/${workflow.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create workflow");
    } finally {
      setCreating(null);
    }
  }

  async function importWorkflow(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Workflow file must be smaller than 1 MB");
      const payload = WorkflowInputSchema.parse(JSON.parse(await file.text()));
      const workflow = await workflowFetch<Workflow>(
        "/api/workflows",
        "POST",
        payload,
      );
      qc.invalidateQueries({ queryKey: ["workflows"] });
      router.push(`/workflows/${workflow.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      input.value = "";
      setImporting(false);
    }
  }

  async function action(workflow: Workflow, kind: "duplicate" | "delete") {
    if (
      kind === "delete" &&
      !(await confirmAction({
        title: `Delete ${workflow.name}?`,
        description:
          "This permanently deletes the workflow and its execution history. This cannot be undone.",
        action: "Delete workflow",
        destructive: true,
      }))
    )
      return;
    setPendingAction(workflow.id);
    try {
      await workflowFetch(
        `/api/workflows/${workflow.id}${kind === "duplicate" ? "/duplicate" : ""}`,
        kind === "duplicate" ? "POST" : "DELETE",
      );
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(
        kind === "duplicate" ? "Workflow duplicated" : "Workflow deleted",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setPendingAction(null);
    }
  }

  function download(workflow: Workflow) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              name: workflow.name,
              description: workflow.description,
              graph: workflow.graph,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    link.href = url;
    link.download = `${workflow.name.replace(/[^\w-]/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="m4m-workflows-index">
      <header className="m4m-workflows-heading m4m-illustrated-heading">
        <div className="m4m-workflows-title">
          <span className="m4m-workflows-title-icon">
            <WorkflowIcon size={24} />
          </span>
          <div>
            <div className="m4m-workflows-title-line">
              <h1>Workflows</h1>
              {!isLoading && !error && <span>{workflows.length}</span>}
            </div>
            <p>Connect a trigger. Route the work. Follow every step.</p>
          </div>
        </div>
        <WorkspaceArtwork />
        <div className="m4m-workflows-heading-actions">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <FileStack size={14} /> Templates
              </Button>
            </DialogTrigger>
            <DialogContent className="m4m-workflow-template-dialog">
              <DialogHeader>
                <DialogTitle>Workflow templates</DialogTitle>
                <DialogDescription>
                  Create a draft, then choose credentials in its action nodes.
                  Setup notes are saved in the workflow settings.
                </DialogDescription>
              </DialogHeader>
              <div className="m4m-workflow-template-options">
                {templates
                  .filter((template) => template.id !== "starter")
                  .sort((a, b) => b.graph.nodes.length - a.graph.nodes.length)
                  .map((template) => (
                    <button
                      key={template.id}
                      disabled={isCreating}
                      aria-busy={creating === template.id}
                      onClick={() => create(template.id)}
                    >
                      <WorkflowIcon size={17} />
                      <span>
                        <strong>{template.name}</strong>
                        <small>
                          {template.summary ?? template.description}
                        </small>
                        <small className="m4m-template-requirements">
                          {template.graph.nodes.length} nodes
                          {template.requirements &&
                            ` · ${template.requirements}`}
                        </small>
                      </span>
                      {creating === template.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </button>
                  ))}
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            disabled={isCreating}
            onClick={() => importInput.current?.click()}
          >
            {importing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Import
          </Button>
          <input
            ref={importInput}
            type="file"
            accept=".json"
            aria-label="Import workflow JSON"
            className="sr-only"
            tabIndex={-1}
            onChange={importWorkflow}
          />
          <Button
            size="sm"
            disabled={isCreating}
            onClick={() => create("starter")}
          >
            {creating === "starter" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            New workflow
          </Button>
        </div>
      </header>

      <div className="m4m-workflows-toolbar">
        <div className="m4m-workflows-tabs" aria-label="Filter workflows">
          {(
            [
              ["all", "All workflows", workflows.length],
              ["active", "Active", activeCount],
              ["draft", "Drafts", workflows.length - activeCount],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              className={filter === value ? "is-active" : ""}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {label}
              <span>{isLoading ? "—" : count}</span>
            </button>
          ))}
        </div>
        <div className="m4m-workflows-search">
          <Search size={14} />
          <Input
            ref={searchInput}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search workflows"
            aria-label="Search workflows"
          />
          {search && (
            <button
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setPage(1);
                searchInput.current?.focus();
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="m4m-workflows-view" aria-label="Workflow view">
          <button
            aria-label="Gallery view"
            aria-pressed={view === "gallery"}
            className={view === "gallery" ? "is-active" : ""}
            onClick={() => setView("gallery")}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            aria-label="List view"
            aria-pressed={view === "list"}
            className={view === "list" ? "is-active" : ""}
            onClick={() => setView("list")}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      <section
        aria-label="Your workflows"
        className="m4m-workflows-collection"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="m4m-workflows-empty" role="status">
            <Loader2 className="animate-spin" size={18} />
            <p>Loading workflows…</p>
          </div>
        ) : error ? (
          <div className="m4m-workflows-empty" role="alert">
            <h2>Could not load workflows</h2>
            <p>{error.message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : visible.length && view === "gallery" ? (
          <div className="m4m-workflows-gallery">
            {paged.map((workflow) => (
              <article className="m4m-workflow-visual-card" key={workflow.id}>
                <Link
                  href={`/workflows/${workflow.id}`}
                  className="m4m-workflow-visual-link"
                  aria-label={`Open ${workflow.name}`}
                  aria-describedby={`workflow-${workflow.id}-status workflow-${workflow.id}-description`}
                >
                  <div className="m4m-workflow-preview-surface">
                    <span
                      id={`workflow-${workflow.id}-status`}
                      className={`m4m-workflow-state ${workflow.activeRevision ? "is-active" : ""}`}
                    >
                      <i />
                      {workflow.activeRevision ? "Active" : "Draft"}
                    </span>
                    <span className="m4m-workflow-preview-open">
                      <ArrowUpRight size={14} />
                    </span>
                    <span className="m4m-route-preview-label">
                      Route preview
                    </span>
                    <WorkflowRouteStrip graph={workflow.graph} />
                  </div>
                  <div className="m4m-workflow-visual-copy">
                    <h2>{workflow.name}</h2>
                    <p id={`workflow-${workflow.id}-description`}>
                      {workflow.description || "No description"}
                    </p>
                  </div>
                </Link>
                <footer className="m4m-workflow-visual-footer">
                  <span>
                    <GitBranch size={13} />
                    {workflow.graph.nodes.length}{" "}
                    {workflow.graph.nodes.length === 1 ? "step" : "steps"}
                  </span>
                  <span>v{workflow.revision}</span>
                  <time
                    dateTime={new Date(workflow.updatedAt).toISOString()}
                    title={new Date(workflow.updatedAt).toLocaleString()}
                  >
                    {new Date(workflow.updatedAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )}
                  </time>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="m4m-workflow-more"
                        aria-label={`Actions for ${workflow.name}`}
                        disabled={pendingAction === workflow.id}
                      >
                        {pendingAction === workflow.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <MoreHorizontal size={16} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="m4m-workflow-actions-menu"
                    >
                      <DropdownMenuItem asChild>
                        <Link href={`/workflows/${workflow.id}`}>
                          <ArrowUpRight size={14} />
                          Open workflow
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => action(workflow, "duplicate")}
                      >
                        <Copy size={14} />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => download(workflow)}>
                        <Download size={14} />
                        Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="m4m-workflow-delete"
                        onSelect={() => action(workflow, "delete")}
                      >
                        <Trash2 size={14} />
                        Delete workflow
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </footer>
              </article>
            ))}
          </div>
        ) : visible.length ? (
          <table className="m4m-workflows-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col" className="m4m-workflow-step-column">
                  Steps
                </th>
                <th scope="col" className="m4m-workflow-date-column">
                  Updated
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((workflow) => (
                <tr key={workflow.id}>
                  <td>
                    <Link
                      href={`/workflows/${workflow.id}`}
                      className="m4m-workflow-name"
                    >
                      <WorkflowIcon size={17} />
                      <span>
                        <strong>{workflow.name}</strong>
                        {workflow.description && (
                          <small>{workflow.description}</small>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`m4m-workflow-state ${workflow.activeRevision ? "is-active" : ""}`}
                    >
                      <i />
                      {workflow.activeRevision ? "Active" : "Draft"}
                    </span>
                  </td>
                  <td className="m4m-workflow-step-column">
                    {workflow.graph.nodes.length}
                  </td>
                  <td className="m4m-workflow-date-column">
                    <time
                      dateTime={new Date(workflow.updatedAt).toISOString()}
                      title={new Date(workflow.updatedAt).toLocaleString()}
                    >
                      {new Date(workflow.updatedAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </time>
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="m4m-workflow-more"
                          aria-label={`Actions for ${workflow.name}`}
                          disabled={pendingAction === workflow.id}
                        >
                          {pendingAction === workflow.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <MoreHorizontal size={16} />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="m4m-workflow-actions-menu"
                      >
                        <DropdownMenuItem asChild>
                          <Link href={`/workflows/${workflow.id}`}>
                            <ArrowUpRight size={14} />
                            Open workflow
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => action(workflow, "duplicate")}
                        >
                          <Copy size={14} />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => download(workflow)}>
                          <Download size={14} />
                          Export JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="m4m-workflow-delete"
                          onSelect={() => action(workflow, "delete")}
                        >
                          <Trash2 size={14} />
                          Delete workflow
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="m4m-workflows-empty">
            <WorkflowIcon size={24} />
            <h2>
              {query || filter !== "all"
                ? "No matching workflows"
                : "No workflows yet"}
            </h2>
            <p>
              {query || filter !== "all"
                ? "Try a different search or filter."
                : "Create a workflow or import an existing one."}
            </p>
            {query || filter !== "all" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isCreating}
                onClick={() => create("starter")}
              >
                <Plus size={14} />
                New workflow
              </Button>
            )}
          </div>
        )}
      </section>
      <CollectionPagination
        page={currentPage}
        pages={pages}
        onChange={setPage}
      />
      {data && !error && (
        <footer className="m4m-workflows-footer">
          <span>
            {visible.length} of {workflows.length} workflows
          </span>
          <span
            className={`m4m-workflows-worker ${data.workerOnline ? "is-online" : ""}`}
          >
            <i />
            {data.runtime === "serverless"
              ? data.schedulerHealthy
                ? "Cloud jobs · scheduler recent"
                : "Cloud jobs · check scheduler"
              : `Worker ${data.workerOnline ? "online" : "offline"}`}
          </span>
        </footer>
      )}
    </main>
  );
}
