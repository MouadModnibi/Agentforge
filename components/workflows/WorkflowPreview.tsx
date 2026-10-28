"use client";

import { useId, type CSSProperties } from "react";
import {
  Bot,
  Braces,
  GitBranch,
  Globe,
  Mail,
  Play,
  Send,
  Webhook,
} from "lucide-react";
import { catalog } from "@/lib/workflows/catalog";
import type { WorkflowGraph } from "@/lib/workflows/schema";

const categoryColors = {
  Triggers: "#e6b775",
  AI: "#b8a2ef",
  Logic: "#91efc3",
  Actions: "#80cddd",
};

/** A small, read-only rendering of the saved graph, including its actual branches. */
export function WorkflowPreview({ graph }: { graph: WorkflowGraph }) {
  const patternId = useId().replace(/:/g, "");
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const connections = graph.edges.flatMap((edge, index) => {
    const source = nodeMap.get(edge.source),
      target = nodeMap.get(edge.target);
    if (!source || !target) return [];
    const x1 = source.position.x + 84,
      y1 = source.position.y + 42;
    const x2 = target.position.x,
      y2 = target.position.y + 42;
    const curve = Math.max(40, Math.abs(x2 - x1) * 0.5);
    return [
      {
        id: edge.id,
        index,
        controlX1: x1 + curve,
        controlX2: x2 - curve,
        path: `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`,
      },
    ];
  });
  const nodeXs = graph.nodes.map((node) => node.position.x);
  const nodeYs = graph.nodes.map((node) => node.position.y);
  if (!nodeXs.length) {
    nodeXs.push(0);
    nodeYs.push(0);
  }
  // A cubic curve stays within its control bounds. Include them so connections
  // that travel backward are not clipped when saved node positions are reused.
  const minX = Math.min(
    ...nodeXs,
    ...connections.map((edge) => edge.controlX2),
  );
  const maxX = Math.max(
    ...nodeXs.map((x) => x + 84),
    ...connections.map((edge) => edge.controlX1),
  );
  const minY = Math.min(...nodeYs);
  const maxY = Math.max(...nodeYs) + 118;
  const width = Math.max(560, maxX - minX + 156);
  const height = Math.max(300, maxY - minY + 82);
  const left = minX - (width - (maxX - minX)) / 2;
  const top = minY - (height - (maxY - minY)) / 2;

  return (
    <svg
      className="m4m-graph-preview"
      viewBox={`${left} ${top} ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={patternId}
          width="22"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r=".8" fill="#536470" opacity=".35" />
        </pattern>
      </defs>
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        fill={`url(#${patternId})`}
      />
      {connections.map((edge) => {
        return (
          <g key={edge.id}>
            <path d={edge.path} fill="none" stroke="#3c5556" strokeWidth="2" />
            <path
              className="m4m-graph-preview-signal"
              d={edge.path}
              fill="none"
              pathLength="100"
              stroke="#91efc3"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 98"
              style={
                { "--signal-delay": `${-edge.index * 0.85}s` } as CSSProperties
              }
            />
          </g>
        );
      })}
      {graph.nodes.map((node) => {
        const definition = catalog[node.kind];
        const color = categoryColors[definition.category];
        const Icon = node.kind.includes("telegram")
          ? Send
          : node.kind.toLowerCase().includes("email")
            ? Mail
            : node.kind === "webhook"
              ? Webhook
              : definition.category === "Triggers"
                ? Play
                : definition.category === "AI"
                  ? Bot
                  : node.kind === "transform" || node.kind === "customTool"
                    ? Braces
                    : definition.category === "Logic"
                      ? GitBranch
                      : Globe;
        const label =
          node.label.length > 21 ? `${node.label.slice(0, 19)}…` : node.label;
        return (
          <g
            key={node.id}
            transform={`translate(${node.position.x}, ${node.position.y})`}
          >
            <rect
              className="m4m-graph-preview-node-shadow"
              x="0"
              y="4"
              width="84"
              height="84"
              rx="18"
              fill="#050b0d"
              opacity=".4"
            />
            <rect
              width="84"
              height="84"
              rx="18"
              fill="#1a242b"
              stroke={color}
              strokeOpacity=".4"
              strokeWidth="1.5"
            />
            <rect
              x="8"
              y="8"
              width="68"
              height="68"
              rx="13"
              fill={color}
              fillOpacity=".055"
            />
            <Icon
              x="27"
              y="27"
              width="30"
              height="30"
              color={color}
              strokeWidth="1.5"
            />
            <circle
              cx="0"
              cy="42"
              r="3.3"
              fill="#1b282c"
              stroke="#708889"
              strokeWidth="1.5"
            />
            <circle
              cx="84"
              cy="42"
              r="3.3"
              fill="#1b282c"
              stroke="#708889"
              strokeWidth="1.5"
            />
            <text
              x="42"
              y="107"
              textAnchor="middle"
              fill="#a6b5bd"
              fontSize="13"
              fontWeight="450"
              fontFamily="inherit"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
