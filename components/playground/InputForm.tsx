"use client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { InputParam } from "@/lib/schemas/agent";

interface Props {
  params: InputParam[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function InputForm({ params, values, onChange }: Props) {
  if (params.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No input parameters defined.
        <br />
        <span className="text-xs">Add parameters in the editor Input tab.</span>
      </div>
    );
  }

  function set(name: string, value: unknown) {
    onChange({ ...values, [name]: value });
  }

  return (
    <div className="space-y-4">
      {params.map((param) => (
        <div key={param.id} className="space-y-1.5">
          <Label className="text-xs">
            {param.name}
            {param.required && <span className="text-destructive ml-0.5">*</span>}
            <span className="ml-1.5 text-muted-foreground font-normal">({param.type})</span>
          </Label>
          {param.description && (
            <p className="text-xs text-muted-foreground">{param.description}</p>
          )}

          {param.type === "boolean" ? (
            <Switch
              checked={Boolean(values[param.name])}
              onCheckedChange={(v) => set(param.name, v)}
              aria-label={param.name}
            />
          ) : param.type === "json" ? (
            <Textarea
              value={typeof values[param.name] === "string" ? (values[param.name] as string) : JSON.stringify(values[param.name] ?? "", null, 2)}
              onChange={(e) => set(param.name, e.target.value)}
              placeholder="{}"
              className="font-mono text-xs h-24"
            />
          ) : param.type === "number" ? (
            <Input
              type="number"
              value={(values[param.name] as string) ?? param.default ?? ""}
              onChange={(e) => set(param.name, parseFloat(e.target.value))}
              placeholder={param.default ?? "0"}
            />
          ) : (
            <Textarea
              value={(values[param.name] as string) ?? param.default ?? ""}
              onChange={(e) => set(param.name, e.target.value)}
              placeholder={param.default ?? `Enter ${param.name}…`}
              rows={3}
            />
          )}
        </div>
      ))}
    </div>
  );
}
