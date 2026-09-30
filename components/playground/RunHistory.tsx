"use client";
import { RotateCcw, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelative } from "@/lib/utils";
import type { Run } from "@/lib/schemas/run";

interface Props {
  runs: Run[];
  onRerun: (input: Record<string, unknown>) => void;
  currentInput: Record<string, unknown>;
}

export function RunHistory({ runs, onRerun, currentInput }: Props) {
  if (runs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        No runs yet. Hit Run to start.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Recent runs ({runs.length})
      </p>
      <ScrollArea className="max-h-64">
        <div className="space-y-1 pr-2">
          {runs.slice(0, 20).map((run) => (
            <div
              key={run.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
            >
              {run.error ? (
                <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              ) : run.valid ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">
                  {formatRelative(run.createdAt)}
                </p>
                {run.durationMs && (
                  <p className="text-xs text-muted-foreground/60">
                    {(run.durationMs / 1000).toFixed(1)}s · {run.llmRequestCount} req
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRerun(run.input as Record<string, unknown>)}
                title="Rerun with these inputs"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
