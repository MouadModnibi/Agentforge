"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ApiKeyPanel } from "@/components/editor/ApiKeyPanel";
import type { AgentConfig } from "@/lib/schemas/agent";

interface Props {
  config: AgentConfig;
  onChange: (partial: Partial<AgentConfig>) => void;
  agentId?: string;
  hasApiKey?: boolean;
  onApiKeyChanged?: () => void;
}

export function AdvancedTab({ config, onChange, agentId, hasApiKey = false, onApiKeyChanged }: Props) {
  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="max-iterations">Max tool-call iterations</Label>
        <Input
          id="max-iterations"
          type="number"
          min={1}
          max={10}
          value={config.maxIterations}
          onChange={(e) => onChange({ maxIterations: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) })}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of LLM calls in a single run (including tool calls). Default: 3.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="repair-retries">Repair retries</Label>
        <Input
          id="repair-retries"
          type="number"
          min={0}
          max={2}
          value={config.repairRetries}
          onChange={(e) => onChange({ repairRetries: Math.max(0, Math.min(2, parseInt(e.target.value) || 1)) })}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          How many times to retry with a repair prompt on JSON validation failure. Default: 1.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timeout">Timeout (ms)</Label>
        <Input
          id="timeout"
          type="number"
          min={1000}
          max={300000}
          step={1000}
          value={config.timeoutMs}
          onChange={(e) => onChange({ timeoutMs: Math.max(1000, parseInt(e.target.value) || 30000) })}
          className="w-40"
        />
        <p className="text-xs text-muted-foreground">
          Maximum time for a single run in milliseconds. Default: 30,000 (30s).
        </p>
      </div>

      <div className="rounded-md bg-muted/50 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Free-tier note</p>
        <p>Each run uses at minimum 1 LLM request, plus 1 per tool call and 1 per repair retry.</p>
        <p>Keep maxIterations and repairRetries low to stay within Gemini free-tier limits (~15 RPM).</p>
      </div>

      {agentId && (
        <>
          <Separator />
          <ApiKeyPanel
            agentId={agentId}
            hasApiKey={hasApiKey}
            onKeyChanged={onApiKeyChanged ?? (() => {})}
          />
        </>
      )}
    </div>
  );
}
