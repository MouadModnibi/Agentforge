"use client";
import { Copy, CheckCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PlaygroundRunResult } from "@/lib/hooks/useRuns";
import { toast } from "sonner";

interface Props {
  result: PlaygroundRunResult | null;
  isLoading: boolean;
  format: "json" | "text" | "markdown";
}

export function OutputPanel({ result, isLoading, format }: Props) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Running agent…</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-dashed min-h-[400px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘↵</kbd> or click Run to see output.
        </p>
      </div>
    );
  }

  if (result.error && !result.output) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 min-h-[200px]">
        <p className="text-sm font-medium text-destructive mb-2">Run failed</p>
        <pre className="text-xs text-destructive/80 whitespace-pre-wrap font-mono">{result.error}</pre>
        <ErrorHint error={result.error} />
      </div>
    );
  }

  const displayText =
    format === "json"
      ? JSON.stringify(result.output, null, 2)
      : String(result.output ?? "");

  function handleCopy() {
    navigator.clipboard.writeText(displayText).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-lg border min-h-[400px] flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {format} output
          </span>
          {result.valid === true && (
            <span className="text-xs text-green-600 dark:text-green-400">✓ valid</span>
          )}
          {result.valid === false && (
            <span className="text-xs text-red-500">✗ invalid schema</span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </div>
      <ScrollArea className="flex-1 p-4">
        <pre className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
          {displayText}
        </pre>
      </ScrollArea>
    </div>
  );
}

function ErrorHint({ error }: { error: string }) {
  const lower = error.toLowerCase();
  let hint = "";
  if (lower.includes("quota") || lower.includes("429") || lower.includes("rate limit") || lower.includes("resource exhausted")) {
    hint = "You've hit Gemini's free-tier rate limit. Wait a minute and try again, or enable billing in Google AI Studio to raise limits.";
  } else if (lower.includes("api key") || lower.includes("missing")) {
    hint = "Add your GOOGLE_GENERATIVE_AI_API_KEY to .env.local and restart the server.";
  } else if (lower.includes("timeout")) {
    hint = "The run exceeded the timeout. Try reducing maxIterations or simplifying your prompt.";
  } else if (lower.includes("json")) {
    hint = "Output couldn't be parsed as JSON. Try enabling strict validation with repair retries.";
  }
  if (!hint) return null;
  return (
    <div className="mt-3 p-2 rounded bg-muted text-xs text-muted-foreground">
      <span className="font-medium">Hint:</span> {hint}
    </div>
  );
}
