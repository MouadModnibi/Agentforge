"use client";
import { useState, useRef, useEffect } from "react";
import { ArrowUpRight, ChevronRight, Search, Plus, X } from "lucide-react";
import { catalog } from "@/lib/workflows/catalog";
import { nodeKinds, type NodeKind } from "@/lib/workflows/schema";
import { icons } from "./WorkflowNode";
export function NodeLibrary({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input,textarea,select,[contenteditable="true"]',
          ))
      )
        return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", search);
    return () => window.removeEventListener("keydown", search);
  }, []);
  const filtered = nodeKinds.filter(
    (kind) =>
      (category === "All" || catalog[kind].category === category) &&
      `${catalog[kind].name} ${catalog[kind].description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="wf-library">
      <div className="wf-library-intro">
        <h2>Add a step</h2>
        <p>Click a node or drag it onto the canvas.</p>
      </div>
      <div className="wf-palette-search">
        <Search size={15} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes..."
          aria-label="Search nodes"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear node search"
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
          >
            <X size={15} />
          </button>
        ) : (
          <kbd>/</kbd>
        )}
      </div>
      <div className="wf-library-categories" aria-label="Node categories">
        {["All", "Triggers", "AI", "Logic", "Actions"].map((c) => (
          <button
            key={c}
            className={c === category ? "active" : ""}
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="wf-library-results">
        <span>{filtered.length} nodes</span>
      </div>
      {["Triggers", "AI", "Logic", "Actions"].map((group) => {
        const kinds = filtered.filter((k) => catalog[k].category === group);
        if (!kinds.length) return null;
        return (
          <section className="wf-palette-group" key={group}>
            <h3>
              {group}
              <span>{kinds.length}</span>
            </h3>
            {kinds.map((kind) => {
              const definition = catalog[kind],
                Icon = icons[definition.icon as keyof typeof icons];
              return (
                <button
                  key={kind}
                  className="wf-library-node"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/agentforge-node", kind);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onAdd(kind)}
                  aria-label={`Add ${definition.name}`}
                >
                  <span
                    className="wf-library-node-icon"
                    style={
                      {
                        "--library-color": definition.color,
                      } as React.CSSProperties
                    }
                  >
                    <Icon size={19} />
                  </span>
                  <div>
                    <strong>{definition.name}</strong>
                    <small>{definition.description}</small>
                  </div>
                  <Plus className="wf-library-plus" size={13} />
                </button>
              );
            })}
          </section>
        );
      })}
      {!filtered.length && (
        <div className="wf-library-empty">
          <Search size={23} />
          <h3>No nodes found</h3>
          <p>Try searching for an app or action.</p>
          <button
            onClick={() => {
              setQuery("");
              setCategory("All");
              searchRef.current?.focus();
            }}
          >
            Clear search <ChevronRight size={12} />
          </button>
        </div>
      )}
      <a href="/credentials" className="wf-library-connect">
        <span>Manage credentials</span>
        <ArrowUpRight size={13} />
      </a>
    </div>
  );
}
