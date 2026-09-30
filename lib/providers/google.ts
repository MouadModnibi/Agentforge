import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getGoogleProvider() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set");
  }
  return createGoogleGenerativeAI({ apiKey });
}
