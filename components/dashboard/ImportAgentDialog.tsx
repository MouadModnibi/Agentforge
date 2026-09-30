"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateAgent } from "@/lib/hooks/useAgents";
import { toast } from "sonner";

export function ImportAgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const createAgent = useCreateAgent();
  const router = useRouter();

  async function handleImport() {
    setError("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("Invalid JSON — please check the format.");
      return;
    }

    if (!parsed.name || typeof parsed.name !== "string") {
      setError("Missing required field: name");
      return;
    }

    try {
      const agent = await createAgent.mutateAsync({
        name: (parsed.name as string) + " (imported)",
        description: (parsed.description as string) || "",
        status: "draft",
        config: (parsed.config as Record<string, unknown>) || {},
        customTool: (parsed.customTool as null) || null,
      });
      onClose();
      setJson("");
      router.push(`/agents/${agent.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import agent from JSON</DialogTitle>
          <DialogDescription>
            Paste the exported agent JSON below. Secrets and API keys are not included in exports.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='{ "name": "My Agent", "config": { ... } }'
          className="font-mono text-xs h-48"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!json.trim() || createAgent.isPending}>
            <Upload className="w-4 h-4" />
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
