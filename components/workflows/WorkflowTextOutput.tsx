"use client";
import { useId, useState } from "react";
import { Download, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function WorkflowTextOutput({
  value,
  filename,
}: {
  value: string;
  filename: string;
}) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const redacted = text.includes("[REDACTED]");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const { createTextPdf } = await import("@/lib/workflows/text-pdf");
      const bytes = await createTextPdf(text);
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 90)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success("PDF download started");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "PDF download failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !text.trim() || redacted}
          onClick={download}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Download />} Download
          PDF
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={editing}
          onClick={() => setEditing(!editing)}
        >
          <Pencil /> {editing ? "Show preview" : "Edit for PDF"}
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Review before downloading. Edits apply only to this PDF preview; the
        saved execution stays unchanged.
      </p>
      {redacted && (
        <p className="wf-error" role="alert">
          Some text was redacted. Use Edit for PDF to correct your contact
          details before downloading.
        </p>
      )}
      {error && (
        <p className="wf-error" role="alert">
          {error}
        </p>
      )}
      {editing ? (
        <>
          <label className="text-xs text-muted-foreground" htmlFor={id}>
            PDF text
          </label>
          <Textarea
            id={id}
            aria-describedby={`${id}-hint`}
            className="min-h-80"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError("");
            }}
          />
        </>
      ) : (
        <pre className="whitespace-pre-wrap">{text}</pre>
      )}
    </div>
  );
}
