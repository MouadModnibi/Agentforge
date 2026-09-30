"use client";
import type { PlaygroundRunResult } from "@/lib/hooks/useRuns";

interface Props {
  result: PlaygroundRunResult | null;
  model: string;
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function MetricsPanel({ result, model }: Props) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed min-h-[300px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No metrics yet. Run the agent first.</p>
      </div>
    );
  }

  const { usage, llmRequestCount, durationMs } = result;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="LLM Requests"
          value={llmRequestCount}
          sub="total calls made"
        />
        <MetricCard
          label="Latency"
          value={durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "—"}
          sub="end-to-end"
        />
        <MetricCard
          label="Prompt tokens"
          value={usage?.promptTokens ?? "—"}
        />
        <MetricCard
          label="Output tokens"
          value={usage?.completionTokens ?? "—"}
        />
      </div>

      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Model</span>
          <span className="font-mono text-xs">{model}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total tokens</span>
          <span>{usage?.totalTokens ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className={result.valid ? "text-green-600 dark:text-green-400" : result.error ? "text-destructive" : "text-muted-foreground"}>
            {result.error ? "error" : result.valid ? "valid" : "invalid"}
          </span>
        </div>
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        Free-tier usage: each LLM request counts against your Gemini quota (~15 RPM on the free tier).
        This run used <strong>{llmRequestCount}</strong> request{llmRequestCount !== 1 ? "s" : ""}.
      </div>
    </div>
  );
}
