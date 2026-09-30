"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { GEMINI_MODELS } from "@/lib/providers/models";
import type { AgentConfig } from "@/lib/schemas/agent";

interface Props {
  form: { name: string; description: string; status: "draft" | "active" };
  onChange: (partial: { name?: string; description?: string; status?: "draft" | "active" }) => void;
  onConfigChange: (partial: Partial<AgentConfig>) => void;
  config?: AgentConfig;
}

// We need the config prop too — parent passes it
export function GeneralTab({ form, onChange, onConfigChange, config }: Props & { config?: AgentConfig }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="My awesome agent"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What does this agent do?"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Model</Label>
        <Select
          value={config?.model || "gemini-2.0-flash"}
          onValueChange={(v) => onConfigChange({ model: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GEMINI_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="font-medium">{m.name}</span>
                {m.description && (
                  <span className="text-muted-foreground ml-2 text-xs">{m.description}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Temperature: {config?.temperature ?? 0.7}</Label>
        <Slider
          min={0}
          max={2}
          step={0.05}
          value={config?.temperature ?? 0.7}
          onChange={(v) => onConfigChange({ temperature: v })}
          label="Temperature"
        />
        <p className="text-xs text-muted-foreground">
          Lower = more focused, higher = more creative.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Max output tokens</Label>
        <Input
          type="number"
          min={1}
          max={8192}
          value={config?.maxTokens ?? 2048}
          onChange={(e) => onConfigChange({ maxTokens: parseInt(e.target.value) || 2048 })}
          className="w-40"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={form.status === "active"}
          onCheckedChange={(checked) => onChange({ status: checked ? "active" : "draft" })}
          id="status-switch"
          aria-labelledby="status-label"
        />
        <div>
          <Label htmlFor="status-switch" id="status-label">Active</Label>
          <p className="text-xs text-muted-foreground">Active agents can be called via the public API.</p>
        </div>
      </div>
    </div>
  );
}
