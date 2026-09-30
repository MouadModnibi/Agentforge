"use client";
import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { Plus, Trash2, Play, CheckCircle2, XCircle, Loader2, Terminal, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CustomTool } from "@/lib/schemas/agent";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-64 border rounded-md bg-muted flex items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

const DEFAULT_CODE = `// AgentForge Custom Tool
// Export an async function named \`run\` that receives (args, ctx).
// ctx.fetch is available for allowed outbound HTTP requests.
// No require(), no process, no filesystem.

async function run(args, ctx) {
  // Example: return a transformed value
  return {
    result: \`Processed: \${JSON.stringify(args)}\`
  };
}`;

const DEFAULT_SCHEMA = `{
  "properties": {
    "input": { "type": "string", "description": "Input value" }
  }
}`;

interface Props {
  customTool: CustomTool | null;
  onChange: (tool: CustomTool | null) => void;
}

interface TestResult {
  status: "idle" | "running" | "success" | "error";
  output?: unknown;
  error?: string;
  durationMs?: number;
}

export function CustomToolTab({ customTool, onChange }: Props) {
  const [testArgs, setTestArgs] = useState("{}");
  const [testArgsError, setTestArgsError] = useState("");
  const [testResult, setTestResult] = useState<TestResult>({ status: "idle" });

  const tool = customTool ?? {
    name: "",
    description: "",
    parameterSchema: DEFAULT_SCHEMA,
    code: DEFAULT_CODE,
  };

  function update(partial: Partial<CustomTool>) {
    if (customTool) {
      onChange({ ...customTool, ...partial });
    } else {
      onChange({ name: "", description: "", parameterSchema: DEFAULT_SCHEMA, code: DEFAULT_CODE, ...partial });
    }
  }

  const handleEnable = useCallback(() => {
    onChange({ name: "", description: "", parameterSchema: DEFAULT_SCHEMA, code: DEFAULT_CODE });
  }, [onChange]);

  const handleDisable = useCallback(() => {
    onChange(null);
  }, [onChange]);

  async function handleTest() {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(testArgs);
      setTestArgsError("");
    } catch {
      setTestArgsError("Invalid JSON");
      return;
    }

    setTestResult({ status: "running" });

    try {
      const res = await fetch("/api/tools/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: tool.code, args, timeoutMs: 3000 }),
      });
      const json = await res.json() as { data?: { result: unknown; durationMs: number }; error?: { code: string; message: string } };

      if (!res.ok || json.error) {
        setTestResult({ status: "error", error: json.error?.message ?? "Test failed" });
      } else {
        setTestResult({
          status: "success",
          output: json.data?.result,
          durationMs: json.data?.durationMs,
        });
      }
    } catch (err) {
      setTestResult({ status: "error", error: err instanceof Error ? err.message : "Network error" });
    }
  }

  if (!customTool) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold">Custom Tool</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Write a JavaScript function your agent can call during execution. Runs in a secure sandbox.
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-4">
            <Terminal className="w-10 h-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No custom tool configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a JavaScript tool to extend your agent's capabilities.
              </p>
            </div>
            <Button onClick={handleEnable}>
              <Plus className="w-4 h-4" />
              Add Custom Tool
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Custom Tool</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The agent can call this function during its reasoning loop.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDisable}>
          <Trash2 className="w-3.5 h-3.5" />
          Remove
        </Button>
      </div>

      {/* Security notice */}
      <div className="flex gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-amber-800 dark:text-amber-300">
          <strong>Sandbox limits:</strong> Code runs in an isolated environment with no filesystem, no{" "}
          <code>require()</code>, no <code>process</code>. Outbound <code>fetch</code> is allowed but goes
          through an SSRF guard. Execution is limited to 5 s. API runs require{" "}
          <code>isolated-vm</code> to be installed.
        </div>
      </div>

      {/* Name & Description */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tool-name">Tool name <span className="text-destructive">*</span></Label>
          <Input
            id="tool-name"
            value={tool.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. calculate, lookup, transform"
            aria-required="true"
          />
          <p className="text-xs text-muted-foreground">
            Identifier used by the model to call this tool (no spaces).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tool-description">Description <span className="text-destructive">*</span></Label>
          <Input
            id="tool-description"
            value={tool.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="What does this tool do?"
            aria-required="true"
          />
          <p className="text-xs text-muted-foreground">
            The model reads this to decide when to call the tool.
          </p>
        </div>
      </div>

      {/* Parameter schema */}
      <div className="space-y-1.5">
        <Label>Parameter schema (JSON Schema properties)</Label>
        <div className="border rounded-md overflow-hidden">
          <MonacoEditor
            height="140px"
            language="json"
            value={tool.parameterSchema}
            onChange={(v) => update({ parameterSchema: v ?? "{}" })}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "off",
              scrollBeyondLastLine: false,
              tabSize: 2,
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Define argument types. Example:{" "}
          <code className="bg-muted px-1 rounded text-xs">
            {"{ \"properties\": { \"x\": { \"type\": \"number\" } } }"}
          </code>
        </p>
      </div>

      {/* Code editor */}
      <div className="space-y-1.5">
        <Label>Function code <span className="text-destructive">*</span></Label>
        <div className="border rounded-md overflow-hidden">
          <MonacoEditor
            height="320px"
            language="javascript"
            value={tool.code}
            onChange={(v) => update({ code: v ?? "" })}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              tabSize: 2,
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Must define <code className="bg-muted px-1 rounded">async function run(args, ctx)</code>. Return
          any serializable value.
        </p>
      </div>

      {/* Test panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Test tool
          </CardTitle>
          <CardDescription className="text-xs">
            Run your tool directly with JSON args. Uses the server sandbox — requires{" "}
            <code>isolated-vm</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-args" className="text-xs">
              Args (JSON)
            </Label>
            <Textarea
              id="test-args"
              value={testArgs}
              onChange={(e) => {
                setTestArgs(e.target.value);
                setTestArgsError("");
              }}
              rows={3}
              className="font-mono text-xs"
              placeholder='{ "input": "hello" }'
              aria-invalid={!!testArgsError}
            />
            {testArgsError && (
              <p className="text-xs text-destructive">{testArgsError}</p>
            )}
          </div>

          <Button
            size="sm"
            onClick={handleTest}
            disabled={testResult.status === "running"}
          >
            {testResult.status === "running" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Run tool
          </Button>

          {testResult.status !== "idle" && (
            <div className="rounded-md border p-3 text-xs font-mono bg-muted/50">
              <div className="flex items-center gap-1.5 mb-2">
                {testResult.status === "success" && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-green-700 dark:text-green-400 font-medium">
                      Success
                      {testResult.durationMs !== undefined && ` · ${testResult.durationMs}ms`}
                    </span>
                  </>
                )}
                {testResult.status === "error" && (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-destructive font-medium">Error</span>
                  </>
                )}
                {testResult.status === "running" && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-muted-foreground">Running…</span>
                  </>
                )}
              </div>
              <pre className="whitespace-pre-wrap break-all">
                {testResult.status === "success"
                  ? JSON.stringify(testResult.output, null, 2)
                  : testResult.error ?? ""}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
