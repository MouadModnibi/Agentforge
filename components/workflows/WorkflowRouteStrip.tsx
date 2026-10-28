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

/** Compact topology view. Only saved edges are drawn; disconnected nodes stay disconnected. */
export function WorkflowRouteStrip({ graph }: { graph: WorkflowGraph }) {
  const nodes = graph.nodes.slice(0, 4);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  );
  const ranks = new Map<string, number>();
  const incoming = new Map(
    nodes.map((n) => [n.id, edges.filter((e) => e.target === n.id).length]),
  );
  const queue = nodes.filter((n) => incoming.get(n.id) === 0).map((n) => n.id);
  queue.forEach((id) => ranks.set(id, 0));
  for (let i = 0; i < queue.length; i++) {
    for (const edge of edges.filter((e) => e.source === queue[i])) {
      ranks.set(
        edge.target,
        Math.max(
          ranks.get(edge.target) ?? 0,
          (ranks.get(edge.source) ?? 0) + 1,
        ),
      );
      incoming.set(edge.target, (incoming.get(edge.target) ?? 1) - 1);
      if (incoming.get(edge.target) === 0) queue.push(edge.target);
    }
  }
  // Cycles retain explicit edges and receive separate columns rather than suggesting a linear path.
  nodes
    .filter((n) => !queue.includes(n.id))
    .forEach((n, i) => ranks.set(n.id, i));
  const maxRank = Math.max(0, ...ranks.values());
  const columns = Array.from({ length: maxRank + 1 }, (_, rank) =>
    nodes.filter((n) => ranks.get(n.id) === rank),
  );
  const rows = Math.max(1, ...columns.map((c) => c.length));
  const width = Math.max(300, (maxRank + 1) * 152),
    height = Math.max(116, rows * 92 + 24);
  const positions = new Map(
    columns.flatMap((column, rank) =>
      column.map(
        (n, row) =>
          [
            n.id,
            {
              x: (width - maxRank * 152) / 2 + rank * 152,
              y: height / 2 + (row - (column.length - 1) / 2) * 92 - 10,
            },
          ] as const,
      ),
    ),
  );
  return (
    <div className="m4m-route-strip">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${graph.nodes.length} nodes and ${graph.edges.length} connections. ${nodes.map((n) => n.label).join(", ")}${graph.nodes.length > 4 ? ". Preview shows first 4 nodes." : ""}`}
      >
        {edges.map((e) => {
          const a = positions.get(e.source)!,
            b = positions.get(e.target)!;
          return (
            <g key={e.id}>
              <path
                d={`M${a.x + 23},${a.y} C${a.x + 75},${a.y} ${b.x - 75},${b.y} ${b.x - 23},${b.y}`}
                className="m4m-route-wire"
              />
              <path
                d={`M${a.x + 23},${a.y} C${a.x + 75},${a.y} ${b.x - 75},${b.y} ${b.x - 23},${b.y}`}
                className="m4m-route-signal"
                pathLength="100"
                aria-hidden="true"
              />
              <path
                d={`M${b.x - 29},${b.y - 3} l6,3 -6,3`}
                className="m4m-route-arrow"
              />
              {e.sourceHandle && e.sourceHandle !== "out" && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 8}
                  textAnchor="middle"
                  className="m4m-route-branch"
                >
                  {e.sourceHandle}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = positions.get(n.id)!;
          const def = catalog[n.kind];
          const Icon = /email/i.test(n.kind)
            ? Mail
            : /telegram/i.test(n.kind)
              ? Send
              : n.kind === "webhook"
                ? Webhook
                : def.category === "Triggers"
                  ? Play
                  : def.category === "AI"
                    ? Bot
                    : def.category === "Logic"
                      ? GitBranch
                      : n.kind === "customTool"
                        ? Braces
                        : Globe;
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              className={def.category === "Triggers" ? "m4m-route-trigger" : ""}
            >
              <title>
                {n.label} · {def.name}
              </title>
              <rect
                x="-23"
                y="-23"
                width="46"
                height="46"
                rx="5"
                className="m4m-route-port"
              />
              <Icon x={-10} y={-10} width={20} height={20} strokeWidth={1.5} />
              <circle cx="23" r="2.5" className="m4m-route-jack" />
              <text y="42" textAnchor="middle">
                {n.label.length > 19 ? `${n.label.slice(0, 17)}…` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      {graph.nodes.length > 4 && (
        <small>+{graph.nodes.length - 4} more nodes in editor</small>
      )}
    </div>
  );
}
