"use client";
import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AgentConfig, InputParam } from "@/lib/schemas/agent";
import { v4 as uuidv4 } from "uuid";

interface Props {
  config: AgentConfig;
  onChange: (partial: Partial<AgentConfig>) => void;
}

export function InputTab({ config, onChange }: Props) {
  const params = config.inputParams || [];

  function addParam() {
    onChange({
      inputParams: [
        ...params,
        { id: uuidv4(), name: "", type: "string", required: true, default: "", description: "" },
      ],
    });
  }

  function updateParam(id: string, partial: Partial<InputParam>) {
    onChange({
      inputParams: params.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    });
  }

  function removeParam(id: string) {
    onChange({ inputParams: params.filter((p) => p.id !== id) });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Input Parameters</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define what inputs your agent accepts. These become the API request body.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={addParam}>
          <Plus className="w-4 h-4" />
          Add parameter
        </Button>
      </div>

      {params.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No parameters yet. Add one to define your agent&apos;s inputs.
        </div>
      )}

      <div className="space-y-3">
        {params.map((param) => (
          <div key={param.id} className="rounded-lg border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={param.name}
                  onChange={(e) => updateParam(param.id, { name: e.target.value })}
                  placeholder="param_name"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={param.type}
                  onValueChange={(v) => updateParam(param.id, { type: v as InputParam["type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">string</SelectItem>
                    <SelectItem value="number">number</SelectItem>
                    <SelectItem value="boolean">boolean</SelectItem>
                    <SelectItem value="json">json (object)</SelectItem>
                    <SelectItem value="file">file (text content)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={param.description || ""}
                onChange={(e) => updateParam(param.id, { description: e.target.value })}
                placeholder="What this parameter is for"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={param.required}
                  onCheckedChange={(v) => updateParam(param.id, { required: v })}
                  id={`req-${param.id}`}
                />
                <Label htmlFor={`req-${param.id}`} className="text-xs">Required</Label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeParam(param.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {params.length > 0 && (
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Generated JSON Schema</p>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({
              type: "object",
              properties: Object.fromEntries(params.map((p) => [p.name || "unnamed", { type: p.type === "json" ? "object" : p.type, description: p.description }])),
              required: params.filter((p) => p.required).map((p) => p.name),
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
