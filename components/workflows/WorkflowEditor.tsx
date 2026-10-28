"use client";
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type DragEvent,
} from "react";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  addEdge,
  MarkerType,
  type Connection,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Save,
  Play,
  Square,
  History,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Trash2,
  Settings2,
  Workflow as FlowIcon,
  ChevronRight,
  Loader2,
  Copy,
  KeyRound,
  RotateCcw,
  Maximize2,
  FileJson,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/ui/confirm-action";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { WorkflowNode, icons, type CanvasNode } from "./WorkflowNode";
import { NodeLibrary } from "./NodeLibrary";
import { WorkflowEdge } from "./WorkflowEdge";
import { catalog, isTrigger, type Field } from "@/lib/workflows/catalog";
import { validateGraph } from "@/lib/workflows/graph";
import {
  WorkflowInputSchema,
  nodeKinds,
  type Workflow,
  type WorkflowGraph,
  type WorkflowNode as DomainNode,
  type NodeKind,
  type WorkflowRun,
} from "@/lib/workflows/schema";
import {
  useWorkflow,
  useWorkflowRuns,
  useWorkflows,
  useCredentials,
  workflowFetch,
} from "@/lib/hooks/useWorkflows";
import { useAgents } from "@/lib/hooks/useAgents";
import { WorkflowTextOutput } from "./WorkflowTextOutput";
const nodeTypes = { workflow: WorkflowNode };
const edgeTypes = { workflow: WorkflowEdge };
function canvasNodes(graph: WorkflowGraph): CanvasNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: "workflow",
    position: node.position,
    data: { node },
  }));
}
function canvasEdges(graph: WorkflowGraph): Edge[] {
  return graph.edges.map((e) => ({
    ...e,
    targetHandle: "in",
    type: "workflow",
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}
export function WorkflowEditor({ id }: { id: string }) {
  const { data, error, isLoading } = useWorkflow(id);
  if (isLoading)
    return (
      <div className="p-10 text-muted-foreground">Opening your canvas…</div>
    );
  if (error || !data)
    return (
      <div className="p-10">
        <p className="text-destructive">
          {error?.message ?? "Workflow not found"}
        </p>
        <Link href="/workflows">Back to workflows</Link>
      </div>
    );
  return (
    <ReactFlowProvider>
      <Editor initial={data} />
    </ReactFlowProvider>
  );
}
function Editor({ initial }: { initial: Workflow }) {
  const confirmAction = useConfirmAction();
  const [workflow, setWorkflow] = useState(initial),
    [name, setName] = useState(initial.name),
    [nodes, setNodes, changeNodes] = useNodesState<CanvasNode>(
      canvasNodes(initial.graph),
    ),
    [edges, setEdges, changeEdges] = useEdgesState(canvasEdges(initial.graph));
  const [selected, setSelected] = useState<string | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [panel, setPanel] = useState<
      "library" | "node" | "run" | "versions" | "settings"
    >("library"),
    [showHistory, setShowHistory] = useState(false),
    [runId, setRunId] = useState<string | null>(null),
    [input, setInput] = useState(
      '{\n  "text": "Hello from m4m",\n  "priority": "high"\n}',
    ),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [serverErrors, setServerErrors] = useState<string[]>([]),
    [versions, setVersions] = useState<
      Array<{ revision: number; graph: WorkflowGraph; createdAt: number }>
    >([]),
    [webhookKey, setWebhookKey] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(
    () => typeof window === "undefined" || window.innerWidth > 760,
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow(),
    { data: agents } = useAgents(),
    { data: credentials } = useCredentials(),
    { data: history } = useWorkflowRuns(initial.id),
    { data: overview } = useWorkflows(),
    qc = useQueryClient();
  const graph = useMemo<WorkflowGraph>(
    () => ({
      nodes: nodes.map((n) => ({ ...n.data.node, position: n.position })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? "out",
      })),
    }),
    [nodes, edges],
  );
  const selectedNode = graph.nodes.find((n) => n.id === selected);
  const run = history?.find((r) => r.id === runId);
  const invalidJson = Object.entries(drafts)
    .filter(([, v]) => {
      try {
        JSON.parse(v);
        return false;
      } catch {
        return true;
      }
    })
    .map(([k]) => `Invalid JSON in ${k.split(":")[1]}.`);
  const graphErrors = useMemo(() => validateGraph(graph), [graph]);
  const errors = [...invalidJson, ...graphErrors, ...serverErrors];
  const visibleNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: run?.steps.find((s) => s.nodeId === n.id)?.status,
        },
      })),
    [nodes, run],
  );
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function openPanel(
    value: "library" | "node" | "run" | "versions" | "settings",
  ) {
    setPanel(value);
    setShowTools(true);
  }
  function updateNode(partial: Partial<DomainNode>) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selected
          ? { ...n, data: { ...n.data, node: { ...n.data.node, ...partial } } }
          : n,
      ),
    );
    setDirty(true);
    setServerErrors([]);
  }
  function setConfig(key: string, value: unknown) {
    if (!selectedNode) return;
    updateNode({ config: { ...selectedNode.config, [key]: value } });
  }
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      changeNodes(changes);
      const removed = new Set(
        changes.filter((c) => c.type === "remove").map((c) => c.id),
      );
      if (removed.size) {
        setDrafts((d) =>
          Object.fromEntries(
            Object.entries(d).filter(
              ([key]) => !removed.has(key.split(":")[0]),
            ),
          ),
        );
        setSelected((id) => (id && removed.has(id) ? null : id));
      }
      if (changes.some((c) => ["position", "remove", "add"].includes(c.type)))
        setDirty(true);
    },
    [changeNodes],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source === c.target) {
        toast.error("A node cannot connect to itself");
        return;
      }
      setEdges((es) =>
        addEdge(
          {
            ...c,
            type: "smoothstep",
            label: c.sourceHandle !== "out" ? c.sourceHandle : undefined,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          es,
        ),
      );
      setDirty(true);
    },
    [setEdges],
  );
  function add(kind: NodeKind, position?: { x: number; y: number }) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    const id = `${kind}_${crypto.randomUUID().slice(0, 8)}`,
      def = catalog[kind],
      node: DomainNode = {
        id,
        kind,
        label: def.name,
        position:
          position ??
          screenToFlowPosition({
            x: bounds
              ? bounds.left + bounds.width / 2 - 60
              : window.innerWidth / 2,
            y: bounds
              ? bounds.top + bounds.height / 2 - 60
              : window.innerHeight / 2,
          }),
        config: structuredClone(def.defaults),
        retry: { attempts: 1, delayMs: 1000 },
        timeoutMs: 30000,
      };
    setNodes((ns) => [
      ...ns,
      { id, type: "workflow", position: node.position, data: { node } },
    ]);
    setSelected(id);
    openPanel("node");
    setDirty(true);
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    const kind = e.dataTransfer.getData(
      "application/agentforge-node",
    ) as NodeKind;
    if (nodeKinds.includes(kind))
      add(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }
  async function save(): Promise<Workflow> {
    if (invalidJson.length) throw new Error(invalidJson.join(" "));
    const payload = WorkflowInputSchema.parse({
      name,
      description: workflow.description,
      graph,
      revision: workflow.revision,
    });
    const w = await workflowFetch<Workflow>(
      `/api/workflows/${workflow.id}`,
      "PATCH",
      payload,
    );
    setWorkflow(w);
    qc.setQueryData(["workflow", w.id], w);
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["workflows"] });
    return w;
  }
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  function toggleActivation() {
    return perform(async () => {
      if (!workflow.activeRevision) await save();
      const w = await workflowFetch<Workflow>(
        `/api/workflows/${workflow.id}/activate`,
        "POST",
        { active: !workflow.activeRevision },
      );
      setWorkflow(w);
      qc.setQueryData(["workflow", w.id], w);
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success(
        w.activeRevision ? "Workflow activated" : "Workflow deactivated",
      );
    });
  }
  async function execute() {
    await save();
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Run input must be a JSON object");
    const result = await workflowFetch<WorkflowRun>(
      `/api/workflows/${workflow.id}/run`,
      "POST",
      { input: parsed },
    );
    setRunId(result.id);
    setShowHistory(true);
    qc.invalidateQueries({ queryKey: ["workflow-runs", workflow.id] });
    toast.success(
      overview?.runtime === "serverless" || overview?.workerOnline
        ? "Workflow queued"
        : "Queued. Start the worker to execute this workflow.",
    );
  }
  function jsonField(field: Field) {
    const key = `${selected}:${field.key}`,
      value =
        drafts[key] ??
        JSON.stringify(selectedNode?.config[field.key] ?? {}, null, 2);
    return (
      <Textarea
        className="wf-json"
        value={value}
        spellCheck={false}
        onChange={(e) => {
          setDrafts((d) => ({ ...d, [key]: e.target.value }));
          setDirty(true);
          try {
            setConfig(field.key, JSON.parse(e.target.value));
          } catch {
            /* Keep the invalid draft visible and block saving. */
          }
        }}
        rows={6}
      />
    );
  }
  function fieldControl(field: Field) {
    const value = selectedNode?.config[field.key];
    if (field.type === "json") return jsonField(field);
    if (field.type === "agent")
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => setConfig(field.key, e.target.value)}
        >
          <option value="">Choose an existing agent…</option>
          {agents?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      );
    if (field.type === "credential") {
      const kind = selectedNode?.kind ?? "http",
        expected = kind.startsWith("telegram")
          ? "telegram"
          : kind.startsWith("email")
            ? "email"
            : kind.startsWith("x")
              ? "x"
              : "http";
      return (
        <>
          <select
            value={String(value ?? "")}
            onChange={(e) => setConfig(field.key, e.target.value)}
          >
            <option value="">
              {expected === "http" ? "None (optional)" : "Choose a credential…"}
            </option>
            {credentials
              ?.filter((c) => c.kind === expected)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <Link href="/credentials" target="_blank" className="wf-field-link">
            Manage credentials <KeyRound size={12} />
          </Link>
        </>
      );
    }
    if (field.type === "select")
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => setConfig(field.key, e.target.value)}
        >
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    return (
      <Textarea
        value={String(value ?? "")}
        onChange={(e) => setConfig(field.key, e.target.value)}
        rows={field.key === "prompt" || field.key === "text" ? 4 : 2}
        placeholder={field.placeholder}
      />
    );
  }
  return (
    <div className="wf-editor">
      <header className="wf-editor-toolbar">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/workflows" title="Back to workflows">
            <ArrowLeft size={18} />
          </Link>
          <span className="wf-toolbar-icon">
            <FlowIcon size={20} />
          </span>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
            className="wf-name"
            aria-label="Workflow name"
          />
          <span className="wf-revision">
            v{workflow.revision}
            {dirty ? " · unsaved" : " · saved"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`wf-activation ${workflow.activeRevision ? "active" : ""}`}
            disabled={busy}
            onClick={toggleActivation}
          >
            <i />
            {workflow.activeRevision
              ? `Active v${workflow.activeRevision}`
              : "Inactive"}
          </button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              perform(async () => {
                await save();
                toast.success("Workflow saved");
              })
            }
          >
            <Save />
            Save
          </Button>
          <Button
            size="sm"
            disabled={
              busy || (!!run && ["queued", "running"].includes(run.status))
            }
            onClick={() => openPanel("run")}
          >
            <Play />
            Run workflow
          </Button>
        </div>
      </header>
      <div className="wf-editor-subbar">
        <div className="flex items-center gap-1">
          <button
            className={!showHistory ? "active" : ""}
            onClick={() => setShowHistory(false)}
          >
            <FlowIcon size={14} />
            Editor
          </button>
          <button
            className={showHistory ? "active" : ""}
            onClick={() => setShowHistory(true)}
          >
            <History size={14} />
            Executions <span>{history?.length ?? 0}</span>
          </button>
          <button
            onClick={() =>
              perform(async () => {
                setVersions(
                  await workflowFetch(`/api/workflows/${workflow.id}/versions`),
                );
                openPanel("versions");
              })
            }
          >
            <RotateCcw size={14} />
            Versions
          </button>
          <button onClick={() => openPanel("settings")}>
            <Settings2 size={14} />
            Settings
          </button>
        </div>
        <span
          className={overview?.workerOnline ? "wf-online" : "wf-offline"}
          aria-label={
            overview?.runtime === "serverless"
              ? "Cloud jobs"
              : `Worker ${overview?.workerOnline ? "online" : "offline"}`
          }
          title={
            overview?.runtime === "serverless"
              ? "Cloud jobs run on incoming requests. Gmail needs the scheduler."
              : `Worker ${overview?.workerOnline ? "online" : "offline"}`
          }
        >
          <i />
          {overview?.runtime === "serverless"
            ? "Cloud jobs"
            : overview?.workerOnline
              ? "Worker connected"
              : "Worker offline"}
        </span>
      </div>
      <div className="wf-editor-body">
        <div className="wf-canvas-stack">
          <div
            className="wf-canvas"
            ref={canvasRef}
            onDrop={drop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
          >
            <ReactFlow<CanvasNode>
              nodes={visibleNodes}
              edges={edges.map((e) => {
                const sourceStatus = run?.steps.find(
                  (s) => s.nodeId === e.source,
                )?.status;
                const targetStatus = run?.steps.find(
                  (s) => s.nodeId === e.target,
                )?.status;
                return {
                  ...e,
                  type: "workflow",
                  data: {
                    running: sourceStatus === "running",
                    muted:
                      !!run &&
                      sourceStatus !== "running" &&
                      targetStatus !== "running",
                  },
                };
              })}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={(changes) => {
                changeEdges(changes);
                if (changes.some((c) => c.type !== "select")) setDirty(true);
              }}
              onConnect={onConnect}
              onNodeClick={(_, n) => {
                setSelected(n.id);
                openPanel("node");
              }}
              onPaneClick={() => setSelected(null)}
              fitView
              fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
              minZoom={0.2}
              maxZoom={2}
              deleteKeyCode={["Backspace", "Delete"]}
              colorMode="dark"
              snapToGrid
              snapGrid={[20, 20]}
            >
              <AutoFitCanvas container={canvasRef} />
              <Background gap={24} size={1} color="#465d65" />
              <Controls />
              <MiniMap
                style={{ width: 120, height: 72 }}
                pannable
                zoomable
                nodeColor={(n) =>
                  catalog[(n.data as CanvasNode["data"]).node.kind].color
                }
              />
            </ReactFlow>
            <div className="wf-canvas-caption">
              <span>
                <FlowIcon size={13} />
                {nodes.length} nodes · {edges.length} connections
              </span>
              <button onClick={() => fitView({ padding: 0.18 })}>
                <Maximize2 size={13} />
                Fit canvas
              </button>
            </div>
            <button
              className="wf-canvas-add"
              onClick={() => openPanel("library")}
              aria-label="Open node library"
              title="Add a node"
            >
              <Plus size={21} />
            </button>
            <div className="wf-canvas-hint">Scroll to zoom · Drag to pan</div>
            {!nodes.length && (
              <div className="wf-canvas-empty">
                <Plus size={28} />
                <h3>Add your first node</h3>
                <p>Choose a trigger from the node library to get started.</p>
              </div>
            )}
          </div>
          {showHistory && (
            <section className="wf-executions">
              <header>
                <h3>
                  <History size={15} />
                  Execution history
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  aria-label="Close execution history"
                >
                  <X size={16} />
                </button>
              </header>
              <div className="wf-executions-body">
                <div className="wf-run-list">
                  {!history?.length && (
                    <p>
                      No executions yet. Run your workflow to see what happens.
                    </p>
                  )}
                  {history?.map((r) => (
                    <button
                      key={r.id}
                      className={runId === r.id ? "selected" : ""}
                      onClick={() => setRunId(r.id)}
                    >
                      <span className={`wf-status-dot ${r.status}`} />
                      <div>
                        <strong>
                          {r.status}
                          <small>
                            v{r.revision} · {r.source}
                          </small>
                        </strong>
                        <time>
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </time>
                      </div>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
                <div className="wf-run-detail">
                  {run ? (
                    <>
                      <div className="flex justify-between gap-3">
                        <div>
                          <strong>Execution {run.id.slice(0, 8)}</strong>
                          <p className="text-xs text-muted-foreground mt-1">
                            {run.status} ·{" "}
                            {run.finishedAt && run.startedAt
                              ? `${((run.finishedAt - run.startedAt) / 1000).toFixed(2)}s`
                              : "Waiting for completion"}
                          </p>
                        </div>
                        {["queued", "running"].includes(run.status) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              perform(async () => {
                                await workflowFetch(
                                  `/api/workflow-runs/${run.id}`,
                                  "POST",
                                  { action: "cancel" },
                                );
                                toast.success("Cancellation requested");
                              })
                            }
                          >
                            <Square />
                            Stop
                          </Button>
                        ) : ["failed", "cancelled", "interrupted"].includes(
                            run.status,
                          ) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (
                                await confirmAction({
                                  title: "Retry this execution?",
                                  description:
                                    "The entire execution will run again. Previously completed messages or API actions may be sent again.",
                                  action: "Retry execution",
                                })
                              )
                                perform(async () => {
                                  const r = await workflowFetch<WorkflowRun>(
                                    `/api/workflow-runs/${run.id}`,
                                    "POST",
                                    {
                                      action: "retry",
                                      acknowledgeSideEffects: true,
                                    },
                                  );
                                  setRunId(r.id);
                                });
                            }}
                          >
                            <RotateCcw />
                            Retry
                          </Button>
                        ) : null}
                      </div>
                      {run.error && (
                        <p className="wf-error" role="alert">
                          {run.error}
                        </p>
                      )}
                      <div className="wf-step-chips">
                        {run.steps.map((s) => (
                          <button
                            key={s.nodeId}
                            className={`status-${s.status}`}
                            onClick={() => {
                              setSelected(s.nodeId);
                              openPanel("node");
                            }}
                          >
                            {s.status === "succeeded" ? (
                              <CheckCircle2 size={12} />
                            ) : s.status === "running" ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <span className="wf-status-dot" />
                            )}
                            {s.label}
                          </button>
                        ))}
                      </div>
                      {typeof run.output === "string" &&
                      run.status === "succeeded" ? (
                        <WorkflowTextOutput
                          key={`${run.id}:final`}
                          value={run.output}
                          filename={`m4m-${run.id.slice(0, 8)}`}
                        />
                      ) : (
                        <pre>{JSON.stringify(run.output, null, 2)}</pre>
                      )}
                    </>
                  ) : (
                    <div className="wf-run-placeholder">
                      <History size={24} />
                      <p>Select an execution to inspect its results.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
        {showTools && (
          <aside className="wf-inspector" aria-label="Workflow tools">
            <div className="wf-drawer-tabs">
              <button
                className={panel === "library" ? "active" : ""}
                onClick={() => openPanel("library")}
              >
                <Plus size={13} />
                Nodes
              </button>
              <button
                className={panel === "node" ? "active" : ""}
                disabled={!selectedNode}
                onClick={() => openPanel("node")}
              >
                <Settings2 size={13} />
                Configure
              </button>
              <button
                className={panel === "run" ? "active" : ""}
                onClick={() => openPanel("run")}
              >
                <Play size={12} />
                Test
              </button>
              <button
                className="wf-close-drawer"
                onClick={() => setShowTools(false)}
                aria-label="Close workflow tools"
              >
                <X size={15} />
              </button>
            </div>
            <header>
              <h3>
                {panel === "library"
                  ? "Node library"
                  : panel === "run"
                    ? "Run workflow"
                    : panel === "versions"
                      ? "Saved versions"
                      : panel === "settings"
                        ? "Workflow settings"
                        : selectedNode
                          ? "Step configuration"
                          : "Your canvas"}
              </h3>
              {selectedNode && panel === "node" && (
                <button
                  onClick={() => {
                    setNodes((ns) => ns.filter((n) => n.id !== selected));
                    setEdges((es) =>
                      es.filter(
                        (e) => e.source !== selected && e.target !== selected,
                      ),
                    );
                    setDrafts((d) =>
                      Object.fromEntries(
                        Object.entries(d).filter(
                          ([k]) => !k.startsWith(`${selected}:`),
                        ),
                      ),
                    );
                    setSelected(null);
                    setDirty(true);
                  }}
                  title="Delete node"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </header>
            <div
              className={`wf-inspector-content ${panel === "library" ? "is-library" : ""}`}
            >
              {panel === "library" && <NodeLibrary onAdd={add} />}
              {panel === "node" &&
                (selectedNode ? (
                  <>
                    <div className="wf-inspector-heading">
                      <span
                        style={{
                          background: `${catalog[selectedNode.kind].color}15`,
                          color: catalog[selectedNode.kind].color,
                        }}
                      >
                        {(() => {
                          const Icon =
                            icons[
                              catalog[selectedNode.kind]
                                .icon as keyof typeof icons
                            ];
                          return <Icon size={24} />;
                        })()}
                      </span>
                      <div>
                        <h2>{catalog[selectedNode.kind].name}</h2>
                        <p>{catalog[selectedNode.kind].description}</p>
                      </div>
                    </div>
                    <label className="wf-field">
                      <span>Step name</span>
                      <Input
                        value={selectedNode.label}
                        onChange={(e) => updateNode({ label: e.target.value })}
                      />
                    </label>
                    {catalog[selectedNode.kind].fields.map((field) => (
                      <label className="wf-field" key={field.key}>
                        <span>{field.label}</span>
                        {fieldControl(field)}
                      </label>
                    ))}
                    <div className="wf-reference-help">
                      <BracesIcon />
                      <strong>Connect your data</strong>
                      <p>
                        Use <code>{"{{input.text}}"}</code> for the previous
                        step, <code>{"{{trigger.text}}"}</code> for the original
                        input, or <code>{`{{nodes.${selectedNode.id}}}`}</code>{" "}
                        to reference a completed step.
                      </p>
                      <small>
                        This step’s ID: <code>{selectedNode.id}</code>
                      </small>
                    </div>
                    {!isTrigger(selectedNode.kind) && (
                      <label className="wf-field">
                        <span>Timeout (milliseconds)</span>
                        <Input
                          type="number"
                          min={100}
                          max={300000}
                          value={selectedNode.timeoutMs}
                          onChange={(e) =>
                            updateNode({ timeoutMs: Number(e.target.value) })
                          }
                        />
                      </label>
                    )}
                    {!isTrigger(selectedNode.kind) &&
                      !["agent", "http", "telegram", "email", "x"].includes(
                        selectedNode.kind,
                      ) && (
                        <>
                          <label className="wf-field">
                            <span>Maximum attempts</span>
                            <Input
                              type="number"
                              min={1}
                              max={3}
                              value={selectedNode.retry.attempts}
                              onChange={(e) =>
                                updateNode({
                                  retry: {
                                    ...selectedNode.retry,
                                    attempts: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                          <label className="wf-field">
                            <span>Retry delay (milliseconds)</span>
                            <Input
                              type="number"
                              min={100}
                              max={30000}
                              value={selectedNode.retry.delayMs}
                              onChange={(e) =>
                                updateNode({
                                  retry: {
                                    ...selectedNode.retry,
                                    delayMs: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </label>
                        </>
                      )}
                    {run?.steps.find((s) => s.nodeId === selected) && (
                      <div className="wf-node-inspection">
                        <h4>Last selected execution</h4>
                        {["input", "output", "error", "usage"].map((key) => (
                          <details key={key} open={key === "output"}>
                            <summary>{key}</summary>
                            {key === "output" &&
                            run.steps.find((s) => s.nodeId === selected)
                              ?.status === "succeeded" &&
                            typeof run.steps.find((s) => s.nodeId === selected)
                              ?.output === "string" ? (
                              <WorkflowTextOutput
                                key={`${run.id}:${selected}`}
                                value={
                                  run.steps.find((s) => s.nodeId === selected)!
                                    .output as string
                                }
                                filename={`m4m-${run.id.slice(0, 8)}-${selected}`}
                              />
                            ) : (
                              <pre>
                                {JSON.stringify(
                                  run.steps.find(
                                    (s) => s.nodeId === selected,
                                  )?.[
                                    key as
                                      "input" | "output" | "error" | "usage"
                                  ],
                                  null,
                                  2,
                                ) ?? "Not available"}
                              </pre>
                            )}
                          </details>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="wf-inspector-empty">
                    <Settings2 size={30} />
                    <h3>Make a connection.</h3>
                    <p>
                      Select a node to configure it.
                      <br />
                      Drag between handles to connect steps.
                    </p>
                    <div>
                      <span>01</span>Start with a trigger
                    </div>
                    <div>
                      <span>02</span>Add an agent or action
                    </div>
                    <div>
                      <span>03</span>Connect, save, and run
                    </div>
                  </div>
                ))}
              {panel === "run" && (
                <>
                  <p className="text-sm text-muted-foreground mb-5">
                    Test your workflow with a JSON input. Your current draft
                    will be saved before execution.
                  </p>
                  <label className="wf-field">
                    <span>Input data</span>
                    <Textarea
                      rows={12}
                      className="wf-json"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </label>
                  {overview?.runtime !== "serverless" &&
                    !overview?.workerOnline && (
                      <p className="wf-notice">
                        The worker is offline. Runs will stay queued until the
                        worker starts.
                      </p>
                    )}
                  <Button
                    className="w-full"
                    disabled={busy || errors.length > 0}
                    onClick={() => perform(execute)}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <Play />}
                    Execute workflow
                  </Button>
                </>
              )}
              {panel === "versions" && (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Every save creates an immutable graph version. Active
                    triggers keep using the version you activated.
                  </p>
                  {versions.map((v) => (
                    <div key={v.revision} className="wf-version">
                      <div>
                        <strong>Version {v.revision}</strong>
                        <small>{new Date(v.createdAt).toLocaleString()}</small>
                      </div>
                      <button
                        disabled={busy}
                        aria-label={`Restore version ${v.revision}`}
                        onClick={async () => {
                          if (
                            !dirty ||
                            (await confirmAction({
                              title: `Restore version ${v.revision}?`,
                              description:
                                "This replaces your unsaved canvas. The restored workflow will be saved as a new revision.",
                              action: "Restore version",
                            }))
                          )
                            perform(async () => {
                              const w = await workflowFetch<Workflow>(
                                `/api/workflows/${workflow.id}/restore`,
                                "POST",
                                { revision: v.revision },
                              );
                              setWorkflow(w);
                              qc.setQueryData(["workflow", w.id], w);
                              setName(w.name);
                              setNodes(canvasNodes(w.graph));
                              setEdges(canvasEdges(w.graph));
                              setDrafts({});
                              setDirty(false);
                              toast.success(
                                "Version restored as a new revision",
                              );
                            });
                        }}
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {panel === "settings" && (
                <>
                  <div className="wf-settings-state">
                    <span
                      className={
                        workflow.activeRevision ? "wf-online" : "wf-offline"
                      }
                    >
                      <i />
                      {workflow.activeRevision
                        ? `Active version ${workflow.activeRevision}`
                        : "This workflow is inactive"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={toggleActivation}
                      disabled={busy}
                    >
                      {workflow.activeRevision
                        ? "Deactivate workflow"
                        : "Activate workflow"}
                    </Button>
                  </div>
                  <label className="wf-field">
                    <span>Description</span>
                    <Textarea
                      value={workflow.description}
                      onChange={(e) => {
                        setWorkflow((w) => ({
                          ...w,
                          description: e.target.value,
                        }));
                        setDirty(true);
                      }}
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="w-full mb-4"
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        await save();
                        const result = await workflowFetch<{
                          errors: string[];
                        }>(`/api/workflows/${workflow.id}/validate`, "POST");
                        setServerErrors(result.errors);
                        toast[result.errors.length ? "error" : "success"](
                          result.errors.length
                            ? result.errors.join(" ")
                            : "Workflow is ready to run",
                        );
                      })
                    }
                  >
                    <CheckCircle2 />
                    Validate workflow
                  </Button>
                  <h4 className="font-semibold text-sm mb-2">
                    Webhook endpoint
                  </h4>
                  <code className="wf-endpoint">
                    /api/workflow-hooks/{workflow.id}
                  </code>
                  <p className="text-xs text-muted-foreground my-3">
                    Activate a Webhook or Telegram trigger before using this
                    endpoint. Telegram needs webhook registration using the
                    secret saved in its credential. Generic Webhook nodes use
                    the generated key below.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        const r = await workflowFetch<{ key: string }>(
                          `/api/workflows/${workflow.id}/webhook-key`,
                          "POST",
                        );
                        setWebhookKey(r.key);
                      })
                    }
                  >
                    <KeyRound />
                    Generate webhook key
                  </Button>
                  {webhookKey && (
                    <div className="wf-key">
                      <p>Copy this key now. It is shown only once.</p>
                      <code>{webhookKey}</code>
                      <button
                        onClick={() =>
                          navigator.clipboard
                            .writeText(webhookKey)
                            .then(() => toast.success("Key copied"))
                        }
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                  <div className="wf-reference-help mt-5">
                    <FileJson size={16} />
                    <strong>Execution model</strong>
                    <p>
                      One trigger. Directed connections. Branches execute only
                      on their selected path. Joins receive an object keyed by
                      their incoming node IDs.
                    </p>
                  </div>
                </>
              )}
              {errors.length > 0 && (
                <div className="wf-validation" role="status">
                  <h4>
                    <AlertCircle size={14} />
                    Needs attention
                  </h4>
                  {[...new Set(errors)].map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
function BracesIcon() {
  return <span className="text-primary text-sm font-mono">{"{ }"}</span>;
}

function AutoFitCanvas({
  container,
}: {
  container: React.RefObject<HTMLDivElement | null>;
}) {
  const ready = useNodesInitialized(),
    { fitView } = useReactFlow(),
    fitted = useRef(false);
  useEffect(() => {
    if (!ready || !container.current) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void fitView({
          padding: 0.18,
          maxZoom: 1,
          duration: fitted.current ? 200 : 0,
        });
        fitted.current = true;
      });
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ready, container, fitView]);
  return null;
}
