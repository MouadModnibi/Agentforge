"use client";
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Play,
  Webhook,
  Bot,
  Sparkles,
  GitBranch,
  Braces,
  Globe,
  Code2,
  Send,
  Mail,
  MessageSquare,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { catalog, isTrigger, outputHandles } from "@/lib/workflows/catalog";
import type {
  WorkflowNode as DomainNode,
  NodeRun,
} from "@/lib/workflows/schema";
export const icons = {
  play: Play,
  webhook: Webhook,
  bot: Bot,
  sparkles: Sparkles,
  split: GitBranch,
  braces: Braces,
  globe: Globe,
  code: Code2,
  send: Send,
  mail: Mail,
  message: MessageSquare,
};
export type CanvasNode = Node<
  { node: DomainNode; status?: NodeRun["status"] },
  "workflow"
>;
export const WorkflowNode = memo(function WorkflowNode({
  data,
  selected,
}: NodeProps<CanvasNode>) {
  const node = data.node,
    def = catalog[node.kind],
    Icon = icons[def.icon as keyof typeof icons],
    handles = outputHandles(node);
  return (
    <div
      className={`wf-node ${selected ? "is-selected" : ""} ${data.status ? "status-" + data.status : ""}`}
      style={{ "--node-color": def.color } as React.CSSProperties}
    >
      {!isTrigger(node.kind) && (
        <Handle type="target" position={Position.Left} id="in" />
      )}
      <div className="wf-node-tile">
        <Icon size={22} strokeWidth={1.6} />
        <span className="wf-node-indicator">
          {data.status === "running" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : data.status === "succeeded" ? (
            <Check size={12} />
          ) : data.status === "failed" ? (
            <AlertCircle size={12} />
          ) : null}
        </span>
      </div>
      <div className="wf-node-main">
        <span className="wf-node-category">
          {def.category === "Triggers"
            ? "Trigger"
            : def.category === "Actions"
              ? "Action"
              : def.category}
        </span>
        <strong>{node.label}</strong>
        <small>{def.name}</small>
      </div>
      {handles.map((id, i) => (
        <div
          key={id}
          className="wf-output-label"
          style={{
            top:
              handles.length === 1
                ? 48
                : 28 + i * Math.min(24, 40 / (handles.length - 1)),
          }}
        >
          {handles.length > 1 && <span>{id}</span>}
          <Handle
            type="source"
            position={Position.Right}
            id={id}
            style={{ top: 0 }}
          />
        </div>
      ))}
      {data.status && <div className="wf-node-status">{data.status}</div>}
    </div>
  );
});
