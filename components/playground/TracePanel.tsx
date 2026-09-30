"use client";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PlaygroundRunResult } from "@/lib/hooks/useRuns";

interface TraceStep {
  type: string;
  data: unknown;
  timestamp: number;
  durationMs?: number;
}

interface Props {
  result: PlaygroundRunResult | null;
}

const STEP_COLORS: Record<string, string> = {
  prompt: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  llm_call: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  tool_call: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  tool_result: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  repair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  output: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

export function TracePanel({ result }: Props) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed min-h-[400px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No trace yet. Run the agent first.</p>
      </div>
    );
  }

  const trace = (result.trace ?? []) as TraceStep[];

  return (
    <ScrollArea className="rounded-lg border min-h-[400px] max-h-[600px]">
      <div className="p-4 space-y-3">
        {trace.length === 0 && (
          <p className="text-sm text-muted-foreground">No trace steps recorded.</p>
        )}
        {trace.map((step, i) => (
          <div key={i} className="rounded-lg border overflow-hidden">
            <div className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${STEP_COLORS[step.type] || "bg-muted"}`}>
              <span className="uppercase tracking-wider">{step.type.replace(/_/g, " ")}</span>
              <span className="ml-auto opacity-70">step {i + 1}</span>
              {step.durationMs !== undefined && (
                <span className="opacity-70">{step.durationMs}ms</span>
              )}
            </div>
            <div className="p-3 bg-background">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-auto">
                {JSON.stringify(step.data, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
