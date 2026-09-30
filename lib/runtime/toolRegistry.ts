import type { ExternalApi } from "@/lib/schemas/agent";
import { guardedFetch } from "@/lib/security/ssrfGuard";
import { decryptSecret } from "@/lib/security/secrets";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

function interpolateTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = vars[key];
    return val !== undefined ? String(val) : "";
  });
}

export function buildExternalApiTools(apis: ExternalApi[]): ToolDefinition[] {
  return apis.map((api) => ({
    name: api.name.replace(/\s+/g, "_").toLowerCase(),
    description: api.description || `Call ${api.name} API`,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query parameters or request data" },
      },
    },
    execute: async (args: Record<string, unknown>) => {
      const queryStr = api.queryTemplate
        ? interpolateTemplate(api.queryTemplate, args)
        : String(args.query ?? "");

      const bodyStr = api.bodyTemplate
        ? interpolateTemplate(api.bodyTemplate, args)
        : api.method !== "GET" ? JSON.stringify(args) : undefined;

      // Decrypt secret headers
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      for (const [k, v] of Object.entries(api.headers)) {
        try {
          headers[k] = v.startsWith("enc:") ? decryptSecret(v.slice(4)) : v;
        } catch {
          headers[k] = v;
        }
      }

      let url = api.baseUrl;
      if (queryStr && api.method === "GET") {
        url += (url.includes("?") ? "&" : "?") + queryStr;
      }

      const response = await guardedFetch(url, {
        method: api.method,
        headers,
        body: bodyStr,
      });

      if (!response.ok) {
        throw new Error(`API ${api.name} returned ${response.status}: ${await response.text()}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        return response.json();
      }
      return response.text();
    },
  }));
}
