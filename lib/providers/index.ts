import { getGoogleProvider } from "./google";

export interface LLMProvider {
  getModel(
    modelId: string,
  ): ReturnType<Awaited<ReturnType<typeof getGoogleProvider>>>;
}

export async function getProvider(): Promise<LLMProvider> {
  const google = await getGoogleProvider();
  return {
    getModel(modelId: string) {
      return google(modelId);
    },
  };
}

export { GEMINI_MODELS, getModel, getDefaultModel } from "./models";
export type { ModelDefinition, ModelCapabilities } from "./models";
