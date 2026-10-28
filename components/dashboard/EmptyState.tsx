"use client";
import {
  Bot,
  Plus,
  FileText,
  Smile,
  ScanText,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateAgent } from "@/lib/hooks/useAgents";
import { useRouter } from "next/navigation";

const TEMPLATES = [
  {
    name: "Text Summarizer",
    description: "Summarizes text into key points",
    emoji: "📝",
    icon: FileText,
    config: {
      systemPrompt:
        "Summarize the following text into clear, concise key points. Return JSON with summary and keyPoints array. Text: {{text}}",
      outputFormat: "json" as const,
    },
  },
  {
    name: "Sentiment Classifier",
    description: "Analyzes text sentiment",
    emoji: "😊",
    icon: Smile,
    config: {
      systemPrompt:
        "Analyze the sentiment of the text. Return JSON with sentiment (positive/negative/neutral/mixed) and confidence (0-1). Text: {{text}}",
      outputFormat: "json" as const,
    },
  },
  {
    name: "Data Extractor",
    description: "Extracts structured data from text",
    emoji: "🔍",
    icon: ScanText,
    config: {
      systemPrompt:
        "Extract all relevant structured information from the provided text. Return as a JSON object. Text: {{text}}",
      outputFormat: "json" as const,
    },
  },
];

export function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  const createAgent = useCreateAgent();
  const router = useRouter();

  async function handleTemplate(tpl: (typeof TEMPLATES)[0]) {
    try {
      const agent = await createAgent.mutateAsync({
        name: tpl.name,
        description: tpl.description,
        status: "draft",
        config: {
          ...tpl.config,
          temperature: 0.3,
          maxTokens: 1024,
          inputParams: [
            {
              id: crypto.randomUUID(),
              name: "text",
              type: "string",
              required: true,
              description: "Text for the agent to process",
            },
          ],
          outputSchema: "{}",
          strictValidation: false,
          maxIterations: 1,
          repairRetries: 1,
          timeoutMs: 30000,
        },
      });
      router.push(`/agents/${agent.id}/edit`);
    } catch {
      /* The mutation hook displays the error. */
    }
  }

  return (
    <div className="forge-empty">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        Your first agent starts here.
      </h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-8">
        Create your first AI agent to start automating tasks with Gemini.
      </p>
      <Button onClick={onCreateNew} className="mb-8">
        <Plus className="w-4 h-4" />
        Create your first agent
      </Button>

      <div className="w-full max-w-2xl">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Or start from a template
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.name}
              onClick={() => handleTemplate(tpl)}
              disabled={createAgent.isPending}
              className="rounded-xl border bg-background/50 p-4 text-left hover:bg-accent hover:border-primary/50 transition-colors disabled:opacity-50"
            >
              <span className="flex justify-between text-primary mb-3">
                <tpl.icon className="w-5 h-5" />
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
              <p className="font-medium text-sm">{tpl.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tpl.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
