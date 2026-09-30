"use client";
import { useState } from "react";
import { Key, Copy, Trash2, RefreshCw, Loader2, Terminal, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  agentId: string;
  hasApiKey: boolean;
  onKeyChanged: () => void; // refresh agent data
}

export function ApiKeyPanel({ agentId, hasApiKey, onKeyChanged }: Props) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const endpoint = `${origin}/api/agents/${agentId}/run`;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/apikey`, { method: "POST" });
      const json = await res.json() as { data?: { apiKey: string }; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to generate key");
      setNewKey(json.data!.apiKey);
      setShowKey(true);
      onKeyChanged();
      toast.success("API key generated — copy it now, it won't be shown again");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/apikey`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke");
      setNewKey(null);
      onKeyChanged();
      toast.success("API key revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRevoking(false);
    }
  }

  const curlSnippet = newKey
    ? `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${newKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"input": {}}'`
    : `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '{"input": {}}'`;

  const fetchSnippet = newKey
    ? `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${newKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ input: {} }),
});
const data = await response.json();`
    : `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ input: {} }),
});
const data = await response.json();`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Key className="w-4 h-4" />
          API Access
        </CardTitle>
        <CardDescription className="text-xs">
          Protect your run endpoint with an API key. The key is shown once — save it immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={hasApiKey ? "success" : "secondary"} className="text-xs">
            {hasApiKey ? "Key configured" : "No key — endpoint is public"}
          </Badge>

          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating || revoking}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {hasApiKey ? "Regenerate" : "Generate key"}
          </Button>

          {hasApiKey && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleRevoke}
              disabled={revoking || generating}
            >
              {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Revoke
            </Button>
          )}
        </div>

        {/* Show newly generated key */}
        {newKey && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              ⚠ Copy this key now — it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-background border rounded px-2 py-1 truncate">
                {showKey ? newKey : "••••••••••••••••••••••••"}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(newKey).then(() => toast.success("Key copied"))}
                aria-label="Copy key"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Code snippets */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Ready-to-use snippets</p>
          </div>

          <SnippetBlock label="cURL" code={curlSnippet} />
          <SnippetBlock label="fetch (JS)" code={fetchSnippet} />
        </div>
      </CardContent>
    </Card>
  );
}

function SnippetBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => copyToClipboard(code).then(() => toast.success(`${label} snippet copied`))}
        >
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </Button>
      </div>
      <pre className="rounded-md bg-muted px-3 py-2.5 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}
