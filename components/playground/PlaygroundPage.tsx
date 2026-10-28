"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Loader2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InputForm } from "./InputForm";
import { OutputPanel } from "./OutputPanel";
import { RunHistory } from "./RunHistory";
import { TracePanel } from "./TracePanel";
import { MetricsPanel } from "./MetricsPanel";
import { useAgent } from "@/lib/hooks/useAgents";
import {
  usePlaygroundRun,
  useRuns,
  type PlaygroundRunResult,
} from "@/lib/hooks/useRuns";
import { toast } from "sonner";

export function PlaygroundPage({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: runs, refetch: refetchRuns } = useRuns(agentId);
  const runMutation = usePlaygroundRun();

  const [input, setInput] = useState<Record<string, unknown>>({});
  const [rawInput, setRawInput] = useState("");
  const [useRawInput, setUseRawInput] = useState(false);
  const [result, setResult] = useState<PlaygroundRunResult | null>(null);
  const [outputTab, setOutputTab] = useState("output");

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  async function handleRun() {
    if (runMutation.isPending) return;
    let payload: Record<string, unknown>;
    if (useRawInput) {
      try {
        payload = JSON.parse(rawInput || "{}");
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          toast.error("Input must be a JSON object");
          return;
        }
      } catch {
        toast.error("Invalid JSON input");
        return;
      }
    } else {
      payload = input;
    }

    try {
      const res = await runMutation.mutateAsync({ agentId, input: payload });
      setResult(res);
      setOutputTab("output");
      refetchRuns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Run failed";
      toast.error(msg);
    }
  }

  function handleRerun(runInput: Record<string, unknown>) {
    setInput(runInput);
    setRawInput(JSON.stringify(runInput, null, 2));
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!agent) {
    return <div className="p-8 text-muted-foreground">Agent not found.</div>;
  }

  return (
    <div className="forge-detail-page bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/")}
            aria-label="Back to agents"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">{agent.name}</span>
          <Badge
            variant={agent.status === "active" ? "success" : "secondary"}
            className="text-xs"
          >
            {agent.status}
          </Badge>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/agents/${agentId}/edit`)}
          >
            <Edit className="w-3.5 h-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Free-tier notice */}
      <div className="m4m-provider-notice">
        Free tier: prompts may be used by Google to improve their products.
        Avoid entering sensitive data.
      </div>

      <div className="m4m-playground-layout">
        {/* Input and history panel */}
        <div className="forge-playground-panel m4m-playground-inputs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Inputs</span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                if (!useRawInput) setRawInput(JSON.stringify(input, null, 2));
                else {
                  try {
                    const parsed = JSON.parse(rawInput || "{}");
                    if (
                      !parsed ||
                      typeof parsed !== "object" ||
                      Array.isArray(parsed)
                    )
                      throw new Error();
                    setInput(parsed);
                  } catch {
                    toast.error(
                      "Enter a valid JSON object before switching to form view",
                    );
                    return;
                  }
                }
                setUseRawInput(!useRawInput);
              }}
            >
              {useRawInput ? "Form view" : "Raw JSON"}
            </button>
          </div>

          {useRawInput ? (
            <textarea
              className="w-full h-64 rounded-md border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="{}"
              aria-label="Raw JSON input"
            />
          ) : (
            <InputForm
              params={agent.config.inputParams || []}
              values={input}
              onChange={setInput}
            />
          )}

          <Separator />

          <RunHistory
            runs={runs || []}
            onRerun={handleRerun}
            currentInput={input}
          />
        </div>

        {/* Main output panel */}
        <div className="forge-playground-panel m4m-playground-output min-w-0">
          <Tabs value={outputTab} onValueChange={setOutputTab}>
            <TabsList>
              <TabsTrigger value="output">Output</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="trace">Trace</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="output">
                <OutputPanel
                  result={result}
                  isLoading={runMutation.isPending}
                  format={agent.config.outputFormat}
                />
              </TabsContent>
              <TabsContent value="validation">
                <ValidationPanel result={result} />
              </TabsContent>
              <TabsContent value="trace">
                <TracePanel result={result} />
              </TabsContent>
              <TabsContent value="metrics">
                <MetricsPanel result={result} model={agent.config.model} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ValidationPanel({ result }: { result: PlaygroundRunResult | null }) {
  if (!result)
    return <EmptyOutput label="Run the agent to see validation results." />;
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${result.valid ? "bg-green-500" : "bg-red-500"}`}
        />
        <span className="font-medium text-sm">
          {result.valid ? "Valid output" : "Validation failed"}
        </span>
      </div>
      {result.error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
          {result.error}
        </div>
      )}
    </div>
  );
}

function EmptyOutput({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
