"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search, Plus, Bot, Play, Edit, Copy, Download, Moon, Sun,
  ArrowRight,
} from "lucide-react";
import { useAgents, useCreateAgent, useDuplicateAgent } from "@/lib/hooks/useAgents";
import { toast } from "sonner";
import type { Agent } from "@/lib/schemas/agent";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: agents } = useAgents(query || undefined);
  const createAgent = useCreateAgent();
  const duplicateAgent = useDuplicateAgent();

  // Reset query when closed
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const run = useCallback(
    (fn: () => void) => {
      fn();
      onClose();
    },
    [onClose]
  );

  function handleExport(agent: Agent) {
    const data = {
      name: agent.name,
      description: agent.description,
      config: agent.config,
      customTool: agent.customTool,
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg mx-4">
        <Command
          className="rounded-xl border bg-background shadow-2xl overflow-hidden"
          shouldFilter={false}
        >
          <div className="flex items-center gap-2 px-3 border-b">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search agents or type a command…"
              className="flex-1 py-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">Esc</kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto py-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Global actions */}
            <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-medium">
              <CommandItem
                icon={<Plus className="w-4 h-4" />}
                label="New agent"
                onSelect={() => run(() => router.push("/agents/new"))}
              />
              <CommandItem
                icon={<Bot className="w-4 h-4" />}
                label="Go to dashboard"
                onSelect={() => run(() => router.push("/"))}
              />
            </Command.Group>

            {/* Agent list */}
            {agents && agents.length > 0 && (
              <Command.Group heading="Agents" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-medium">
                {agents.slice(0, 8).map((agent) => (
                  <Command.Group key={agent.id} className="[&_[cmdk-group-heading]]:hidden">
                    <CommandItem
                      icon={<Bot className="w-4 h-4 text-primary" />}
                      label={agent.name}
                      description={agent.description || agent.config.model}
                      onSelect={() => run(() => router.push(`/agents/${agent.id}/edit`))}
                      suffix={<ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />}
                    />
                    {query.length > 0 && (
                      <>
                        <CommandItem
                          icon={<Play className="w-4 h-4" />}
                          label={`Test "${agent.name}"`}
                          onSelect={() => run(() => router.push(`/agents/${agent.id}/playground`))}
                          indent
                        />
                        <CommandItem
                          icon={<Edit className="w-4 h-4" />}
                          label={`Edit "${agent.name}"`}
                          onSelect={() => run(() => router.push(`/agents/${agent.id}/edit`))}
                          indent
                        />
                        <CommandItem
                          icon={<Copy className="w-4 h-4" />}
                          label={`Duplicate "${agent.name}"`}
                          onSelect={() => run(() => duplicateAgent.mutate(agent.id))}
                          indent
                        />
                        <CommandItem
                          icon={<Download className="w-4 h-4" />}
                          label={`Export "${agent.name}"`}
                          onSelect={() => run(() => handleExport(agent))}
                          indent
                        />
                      </>
                    )}
                  </Command.Group>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="border-t px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span><kbd className="border rounded px-1 py-0.5">↑↓</kbd> navigate</span>
            <span><kbd className="border rounded px-1 py-0.5">↵</kbd> select</span>
            <span><kbd className="border rounded px-1 py-0.5">Esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

interface CommandItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  suffix?: React.ReactNode;
  onSelect: () => void;
  indent?: boolean;
}

function CommandItem({ icon, label, description, suffix, onSelect, indent }: CommandItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm rounded-md mx-1 hover:bg-accent aria-selected:bg-accent transition-colors outline-none ${indent ? "pl-8" : ""}`}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground text-xs ml-2 truncate">{description}</span>
        )}
      </div>
      {suffix}
    </Command.Item>
  );
}
