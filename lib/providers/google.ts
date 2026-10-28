import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { accountModelKey } from "@/lib/security/accounts";

export async function getGoogleProvider() {
  const apiKey = await accountModelKey();
  if (!apiKey) {
    throw new Error("Add your Gemini API key in Account settings.");
  }
  return createGoogleGenerativeAI({ apiKey });
}
