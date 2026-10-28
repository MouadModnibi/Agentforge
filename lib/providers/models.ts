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
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    description: "Latest model. Best for most tasks. Recommended default.",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    description: "Fast and capable. Good balance of speed and quality.",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    description: "Fastest and cheapest. Best for high-volume simple tasks.",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Most powerful reasoning and coding. Use for complex tasks.",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 2097152,
    },
  },
];

export function getModel(id: string): ModelDefinition | undefined {
  return GEMINI_MODELS.find((m) => m.id === id);
}

export function getDefaultModel(): ModelDefinition {
  const defaultId = process.env.GEMINI_DEFAULT_MODEL || "gemini-3.8-flash";
  return getModel(defaultId) ?? GEMINI_MODELS[0];
}
