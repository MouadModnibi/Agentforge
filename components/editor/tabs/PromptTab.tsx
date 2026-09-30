"use client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgentConfig } from "@/lib/schemas/agent";

interface Props {
  config: AgentConfig;
  onChange: (partial: Partial<AgentConfig>) => void;
}

export function PromptTab({ config, onChange }: Props) {
  const charCount = config.systemPrompt.length;
  const tokenEstimate = Math.ceil(charCount / 4);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="system-prompt">System Prompt</Label>
          <span className="text-xs text-muted-foreground">
            ~{tokenEstimate} tokens ({charCount} chars)
          </span>
        </div>
        <Textarea
          id="system-prompt"
          value={config.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          placeholder={"You are a helpful assistant.\n\nUse {{variable_name}} to interpolate inputs."}
          className="font-mono text-sm min-h-[320px]"
        />
      </div>

      <div className="rounded-md bg-muted p-4 text-sm space-y-2">
        <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Prompt Tips</p>
        <ul className="space-y-1 text-muted-foreground text-xs list-disc list-inside">
          <li>Use <code className="bg-background px-1 rounded">{"{{variable_name}}"}</code> to interpolate input parameters</li>
          <li>For JSON output, specify the exact structure you want in your prompt</li>
          <li>Be explicit about your output format — it will be appended automatically based on your Output tab settings</li>
          <li>Keep prompts focused and specific for best results on the free tier</li>
        </ul>
      </div>
    </div>
  );
}
