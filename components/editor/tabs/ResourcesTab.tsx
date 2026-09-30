"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Resource {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  content: string;
  createdAt: string;
}

interface Props { agentId?: string; }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResourcesTab({ agentId }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: resources = [] } = useQuery<Resource[]>({
    queryKey: ["resources", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/resources`);
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!agentId,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/agents/${agentId}/resources`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resources", agentId] }); toast.success("File uploaded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/agents/${agentId}/resources/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["resources", agentId] }); toast.success("File removed"); },
  });

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    if (resources.length + files.length > 5) {
      toast.error("Maximum 5 files per agent");
      return;
    }
    for (const file of Array.from(files)) {
      if (file.size > 1024 * 1024) { toast.error(`${file.name} exceeds 1 MB limit`); continue; }
      await upload.mutateAsync(file);
    }
  }

  if (!agentId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg border border-dashed">
        <AlertCircle className="w-4 h-4" />
        Save the agent first, then add resources.
      </div>
    );
  }

  const totalTokens = Math.ceil(resources.reduce((a, r) => a + r.content.length, 0) / 4);

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h3 className="font-medium">Context Resources</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload files (.json, .txt, .md, .csv) to inject as context. Max 1 MB each, 5 files total.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">.json .txt .md .csv — max 1 MB each</p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".json,.txt,.md,.csv,text/*,application/json"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {resources.length > 0 && (
        <>
          {totalTokens > 4000 && (
            <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 rounded-md p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              ~{totalTokens} tokens used by resources. Consider trimming to stay within context limits.
            </div>
          )}
          <div className="space-y-2">
            {resources.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(r.size)} · {r.mimeType}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(r.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
