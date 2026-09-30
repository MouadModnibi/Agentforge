export interface ModelCapabilities {
  supportsToolsWithStructuredOutput: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
}

export interface ModelDefinition {
  id: string;
  name: string;
  capabilities: ModelCapabilities;
  description?: string;
}

export const GEMINI_MODELS: ModelDefinition[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Fast, efficient model for most tasks. Recommended default.",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    description: "Lightest model, best for high-volume, low-complexity tasks.",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    description: "Balanced speed and capability.",
    capabilities: {
      supportsToolsWithStructuredOutput: false,
      supportsStreaming: true,
      contextWindow: 1048576,
    },
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    description: "Most capable model for complex reasoning tasks.",
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
  const defaultId = process.env.GEMINI_DEFAULT_MODEL || "gemini-2.0-flash";
  return getModel(defaultId) || GEMINI_MODELS[0];
}
