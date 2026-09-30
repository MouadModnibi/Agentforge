import { getGoogleProvider } from "./google";
import type { ModelDefinition } from "./models";

export interface LLMProvider {
  getModel(modelId: string): ReturnType<ReturnType<typeof getGoogleProvider>>;
}

export function getProvider(): LLMProvider {
  const google = getGoogleProvider();
  return {
    getModel(modelId: string) {
      return google(modelId);
    },
  };
}

export { GEMINI_MODELS, getModel, getDefaultModel } from "./models";
export type { ModelDefinition, ModelCapabilities } from "./models";
