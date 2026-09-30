"use client";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateAgent } from "@/lib/hooks/useAgents";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const TEMPLATES = [
  {
    name: "Text Summarizer",
    description: "Summarizes text into key points",
    emoji: "📝",
    config: { model: "gemini-2.0-flash", systemPrompt: "Summarize the following text into clear, concise key points. Return JSON with summary and keyPoints array.", outputFormat: "json" as const },
  },
  {
    name: "Sentiment Classifier",
    description: "Analyzes text sentiment",
    emoji: "😊",
    config: { model: "gemini-2.0-flash", systemPrompt: "Analyze the sentiment of the text. Return JSON with sentiment (positive/negative/neutral/mixed) and confidence (0-1).", outputFormat: "json" as const },
  },
  {
    name: "Data Extractor",
    description: "Extracts structured data from text",
    emoji: "🔍",
    config: { model: "gemini-2.0-flash", systemPrompt: "Extract all relevant structured information from the provided text. Return as a JSON object.", outputFormat: "json" as const },
  },
];

export function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  const createAgent = useCreateAgent();
  const router = useRouter();

  async function handleTemplate(tpl: typeof TEMPLATES[0]) {
    const agent = await createAgent.mutateAsync({
      name: tpl.name,
      description: tpl.description,
      status: "draft",
      config: { ...tpl.config, temperature: 0.3, maxTokens: 1024, inputParams: [], outputSchema: "{}", strictValidation: false, maxIterations: 1, repairRetries: 1, timeoutMs: 30000 },
    });
    router.push(`/agents/${agent.id}/edit`);
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No agents yet</h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-8">
        Create your first AI agent to start automating tasks with Gemini.
      </p>
      <Button onClick={onCreateNew} className="mb-8">
        <Plus className="w-4 h-4" />
        Create your first agent
      </Button>

      <div className="w-full max-w-lg">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Or start from a template
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => handleTemplate(tpl)}
              disabled={createAgent.isPending}
              className="rounded-lg border p-4 text-left hover:bg-accent hover:border-primary/50 transition-colors disabled:opacity-50"
            >
              <span className="text-2xl mb-2 block">{tpl.emoji}</span>
              <p className="font-medium text-sm">{tpl.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
