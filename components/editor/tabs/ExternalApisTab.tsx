"use client";
import { useState } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Upload, Eye, EyeOff, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { markSecretForEncryption } from "@/lib/security/secrets-client";
import type { ExternalApi } from "@/lib/schemas/agent";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

interface Props {
  externalApis: ExternalApi[];
  onChange: (apis: ExternalApi[]) => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function emptyApi(): ExternalApi {
  return {
    id: uuidv4(),
    name: "",
    baseUrl: "",
    method: "GET",
    headers: {},
    queryTemplate: "",
    bodyTemplate: "",
    description: "",
    secretKeys: [],
  };
}

// Per-api UI state
interface ApiUIState {
  expanded: boolean;
  showSecrets: Record<string, boolean>;
  newHeaderKey: string;
  newHeaderVal: string;
  newHeaderIsSecret: boolean;
}

function defaultUiState(): ApiUIState {
  return {
    expanded: true,
    showSecrets: {},
    newHeaderKey: "",
    newHeaderVal: "",
    newHeaderIsSecret: false,
  };
}

export function ExternalApisTab({ externalApis, onChange }: Props) {
  const [uiStates, setUiStates] = useState<Record<string, ApiUIState>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  function getUI(id: string): ApiUIState {
    return uiStates[id] ?? defaultUiState();
  }

  function setUI(id: string, partial: Partial<ApiUIState>) {
    setUiStates((prev) => ({ ...prev, [id]: { ...getUI(id), ...partial } }));
  }

  function updateApi(id: string, partial: Partial<ExternalApi>) {
    onChange(externalApis.map((a) => (a.id === id ? { ...a, ...partial } : a)));
  }

  function removeApi(id: string) {
    onChange(externalApis.filter((a) => a.id !== id));
  }

  function addApi() {
    const api = emptyApi();
    onChange([...externalApis, api]);
    setUI(api.id, { expanded: true, showSecrets: {}, newHeaderKey: "", newHeaderVal: "", newHeaderIsSecret: false });
  }

  function addHeader(api: ExternalApi) {
    const ui = getUI(api.id);
    if (!ui.newHeaderKey.trim()) return;

    const val = ui.newHeaderIsSecret
      ? markSecretForEncryption(ui.newHeaderVal)
      : ui.newHeaderVal;

    updateApi(api.id, {
      headers: { ...api.headers, [ui.newHeaderKey]: val },
      secretKeys: ui.newHeaderIsSecret
        ? [...(api.secretKeys ?? []), ui.newHeaderKey]
        : api.secretKeys,
    });
    setUI(api.id, { newHeaderKey: "", newHeaderVal: "", newHeaderIsSecret: false });
  }

  function removeHeader(api: ExternalApi, key: string) {
    const headers = { ...api.headers };
    delete headers[key];
    updateApi(api.id, {
      headers,
      secretKeys: (api.secretKeys ?? []).filter((k) => k !== key),
    });
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const res = await fetch("/api/openapi/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: importText }),
      });
      const json = await res.json() as {
        data?: { apis: ExternalApi[]; title: string };
        error?: { message: string };
      };
      if (!res.ok || json.error) {
        toast.error(json.error?.message ?? "Import failed");
        return;
      }
      const newApis = json.data!.apis;
      onChange([...externalApis, ...newApis]);
      setImportOpen(false);
      setImportText("");
      toast.success(`Imported ${newApis.length} operation${newApis.length !== 1 ? "s" : ""} from ${json.data!.title}`);
    } catch {
      toast.error("Failed to import spec");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">External APIs</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add HTTP endpoints your agent can call as tools. Secret header values are encrypted at rest.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen((v) => !v)}>
            <Upload className="w-3.5 h-3.5" />
            Import OpenAPI
          </Button>
          <Button size="sm" onClick={addApi}>
            <Plus className="w-3.5 h-3.5" />
            Add API
          </Button>
        </div>
      </div>

      {/* OpenAPI import panel */}
      {importOpen && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <p className="text-sm font-medium">Paste an OpenAPI 3.x JSON spec</p>
            <p className="text-xs text-muted-foreground">
              Operations will be converted to tools automatically. Max 20 operations imported.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              className="font-mono text-xs"
              placeholder={'{\n  "openapi": "3.0.0",\n  "info": { "title": "My API" },\n  "paths": { ... }\n}'}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleImport} disabled={importing || !importText.trim()}>
                {importing ? "Importing…" : "Import"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setImportOpen(false); setImportText(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API list */}
      {externalApis.length === 0 && (
        <div className="py-12 flex flex-col items-center gap-3 text-center border rounded-lg border-dashed">
          <Globe className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">No external APIs configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add APIs your agent can call, or import an OpenAPI spec.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {externalApis.map((api) => {
          const ui = getUI(api.id);
          return (
            <Card key={api.id}>
              {/* Header row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer select-none"
                onClick={() => setUI(api.id, { expanded: !ui.expanded })}
                role="button"
                aria-expanded={ui.expanded}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setUI(api.id, { expanded: !ui.expanded })}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      {api.method}
                    </Badge>
                    <span className="font-medium text-sm truncate">
                      {api.name || <span className="text-muted-foreground italic">Unnamed API</span>}
                    </span>
                  </div>
                  {api.baseUrl && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{api.baseUrl}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeApi(api.id); }}
                  aria-label="Remove API"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                {ui.expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>

              {ui.expanded && (
                <CardContent className="pt-0 space-y-4">
                  <Separator />

                  {/* Name + Method */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor={`name-${api.id}`}>Name <span className="text-destructive">*</span></Label>
                      <Input
                        id={`name-${api.id}`}
                        value={api.name}
                        onChange={(e) => updateApi(api.id, { name: e.target.value })}
                        placeholder="e.g. search_products"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`method-${api.id}`}>Method</Label>
                      <Select
                        value={api.method}
                        onValueChange={(v) => updateApi(api.id, { method: v as ExternalApi["method"] })}
                      >
                        <SelectTrigger id={`method-${api.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HTTP_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`url-${api.id}`}>Base URL <span className="text-destructive">*</span></Label>
                    <Input
                      id={`url-${api.id}`}
                      value={api.baseUrl}
                      onChange={(e) => updateApi(api.id, { baseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1/endpoint"
                      type="url"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`desc-${api.id}`}>Description</Label>
                    <Input
                      id={`desc-${api.id}`}
                      value={api.description ?? ""}
                      onChange={(e) => updateApi(api.id, { description: e.target.value })}
                      placeholder="What does this endpoint do? (Shown to the model)"
                    />
                  </div>

                  {/* Query / Body templates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`query-${api.id}`}>Query template</Label>
                      <Input
                        id={`query-${api.id}`}
                        value={api.queryTemplate ?? ""}
                        onChange={(e) => updateApi(api.id, { queryTemplate: e.target.value })}
                        placeholder="q={{query}}&limit=10"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">Use {"{{variable}}"} for LLM-supplied values.</p>
                    </div>
                    {api.method !== "GET" && (
                      <div className="space-y-1.5">
                        <Label htmlFor={`body-${api.id}`}>Body template (JSON)</Label>
                        <Input
                          id={`body-${api.id}`}
                          value={api.bodyTemplate ?? ""}
                          onChange={(e) => updateApi(api.id, { bodyTemplate: e.target.value })}
                          placeholder='{"query":"{{query}}"}'
                          className="font-mono text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Headers */}
                  <div className="space-y-2">
                    <Label>Headers</Label>
                    {Object.entries(api.headers).length > 0 && (
                      <div className="border rounded-md divide-y">
                        {Object.entries(api.headers).map(([k, v]) => {
                          const isSecret = (api.secretKeys ?? []).includes(k);
                          const visible = ui.showSecrets[k];
                          return (
                            <div key={k} className="flex items-center gap-2 px-3 py-2 text-xs">
                              <span className="font-mono font-medium w-36 truncate">{k}</span>
                              <span className="flex-1 font-mono text-muted-foreground truncate">
                                {isSecret
                                  ? visible ? (v.startsWith("enc:") ? "(encrypted)" : v) : "••••••••"
                                  : v}
                              </span>
                              {isSecret && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setUI(api.id, { showSecrets: { ...ui.showSecrets, [k]: !visible } })}
                                  aria-label={visible ? "Hide" : "Show"}
                                >
                                  {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </Button>
                              )}
                              {isSecret && (
                                <Badge variant="secondary" className="text-[10px]">secret</Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removeHeader(api, k)}
                                aria-label={`Remove header ${k}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add header row */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Key</Label>
                        <Input
                          value={ui.newHeaderKey}
                          onChange={(e) => setUI(api.id, { newHeaderKey: e.target.value })}
                          placeholder="Authorization"
                          className="h-8 text-xs font-mono"
                          onKeyDown={(e) => e.key === "Enter" && addHeader(api)}
                        />
                      </div>
                      <div className="flex-[2] space-y-1">
                        <Label className="text-xs">Value</Label>
                        <Input
                          value={ui.newHeaderVal}
                          onChange={(e) => setUI(api.id, { newHeaderVal: e.target.value })}
                          placeholder="Bearer sk-..."
                          className="h-8 text-xs font-mono"
                          type={ui.newHeaderIsSecret ? "password" : "text"}
                          onKeyDown={(e) => e.key === "Enter" && addHeader(api)}
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer pb-1 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={ui.newHeaderIsSecret}
                          onChange={(e) => setUI(api.id, { newHeaderIsSecret: e.target.checked })}
                          className="rounded"
                          aria-label="Mark as secret"
                        />
                        Secret
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => addHeader(api)}
                        disabled={!ui.newHeaderKey.trim()}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Secret values are encrypted at rest and never appear in exports or logs.
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}


