export interface ModelCapabilities {
  supportsToolsWithStructuredOutput: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
}

export interface ModelDefinition {
  id: string;
  name: string;
  description?: string;
  capabilities: ModelCapabilities;
}

export const GEMINI_MODELS: ModelDefinition[] = [
  {
    id: "gemini-2.5-flash-preview-05-20",
    name: "Gemini 2.5 Flash",
    description: "Latest and fastest. Best for most tasks. Recommended default.",
    capabilities: {
      supportsToolsWithStructuredOutput: true,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-2.5-pro-preview-06-05",
    name: "Gemini 2.5 Pro",
    description: "Most powerful reasoning and coding. Use for complex tasks.",
    capabilities: {
      supportsToolsWithStructuredOutput: true,
      supportsStreaming: true,
      contextWindow: 2097152,
    },
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Fast and capable. Good balance of speed and quality.",
    capabilities: {
      supportsToolsWithStructuredOutput: true,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash-Lite",
    description: "Fastest and cheapest. Best for high-volume simple tasks.",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    description: "Stable previous generation. Wide availability.",
    capabilities: {
      supportsToolsWithStructuredOutput: true,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    description: "Stable previous generation Pro. Large context window.",
    capabilities: {
      supportsToolsWithStructuredOutput: true,
      supportsStreaming: true,
      contextWindow: 2097152,
    },
  },
];

export function getModel(id: string): ModelDefinition | undefined {
  return GEMINI_MODELS.find((m) => m.id === id);
}

export function getDefaultModel(): ModelDefinition {
  const defaultId = process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash-preview-05-20";
  return getModel(defaultId) ?? GEMINI_MODELS[0];
}
