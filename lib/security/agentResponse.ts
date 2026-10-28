import type { Agent } from "@/lib/schemas/agent";
export function publicAgent(agent: Agent): Agent {
  return {
    ...agent,
    apiKeyHash: agent.apiKeyHash ? "configured" : null,
    externalApis: agent.externalApis.map((api) => ({
      ...api,
      headers: Object.fromEntries(
        Object.entries(api.headers).map(([key, value]) => [
          key,
          value.startsWith("enc:") ? "enc:[REDACTED]" : value,
        ]),
      ),
    })),
  };
}
