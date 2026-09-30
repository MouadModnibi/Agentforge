"use client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentConfig } from "@/lib/schemas/agent";

interface Props {
  config: AgentConfig;
  onChange: (partial: Partial<AgentConfig>) => void;
}

export function OutputTab({ config, onChange }: Props) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label>Output Format</Label>
        <Select
          value={config.outputFormat}
          onValueChange={(v) => onChange({ outputFormat: v as AgentConfig["outputFormat"] })}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON (structured)</SelectItem>
            <SelectItem value="text">Plain text</SelectItem>
            <SelectItem value="markdown">Markdown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.outputFormat === "json" && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="output-schema">Output JSON Schema</Label>
              <span className="text-xs text-muted-foreground">Leave empty for any valid JSON</span>
            </div>
            <Textarea
              id="output-schema"
              value={config.outputSchema || "{}"}
              onChange={(e) => onChange({ outputSchema: e.target.value })}
              className="font-mono text-xs min-h-[200px]"
              placeholder='{ "type": "object", "properties": { "result": { "type": "string" } }, "required": ["result"] }'
            />
            <p className="text-xs text-muted-foreground">
              JSON Schema Draft 7. The agent output will be validated against this schema.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="strict-validation"
              checked={config.strictValidation}
              onCheckedChange={(v) => onChange({ strictValidation: v })}
            />
            <div>
              <Label htmlFor="strict-validation">Strict validation + auto-repair</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                On failure, send a repair prompt using up to {config.repairRetries} additional LLM request(s).
              </p>
            </div>
          </div>
        </>
      )}

      {config.outputFormat !== "json" && (
        <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
          {config.outputFormat === "text" && "The agent will return plain text output. No schema validation."}
          {config.outputFormat === "markdown" && "The agent will format its response as Markdown."}
        </div>
      )}
    </div>
  );
}
