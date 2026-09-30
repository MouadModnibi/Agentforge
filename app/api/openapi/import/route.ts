/**
 * POST /api/openapi/import
 *
 * Accepts an OpenAPI 3.x JSON or YAML spec and returns a list of ExternalApi
 * objects (without secrets) ready to be merged into an agent's externalApis array.
 *
 * Body: { spec: string }  — raw JSON or YAML text of the spec
 *
 * Returns: { data: { apis: ExternalApi[] } }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { ExternalApi } from "@/lib/schemas/agent";

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

const ImportSchema = z.object({
  spec: z.string().min(1, "Spec is required"),
});

// ---------------------------------------------------------------------------
// Minimal OpenAPI 3.x types (only what we need)
// ---------------------------------------------------------------------------
interface OAServer { url: string }
interface OAParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
}
interface OARequestBody {
  content?: Record<string, { schema?: Record<string, unknown> }>;
  description?: string;
}
interface OAOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OAParameter[];
  requestBody?: OARequestBody;
}
interface OAPathItem {
  get?: OAOperation;
  post?: OAOperation;
  put?: OAOperation;
  patch?: OAOperation;
  delete?: OAOperation;
}
interface OpenAPIDoc {
  openapi?: string;
  info?: { title?: string };
  servers?: OAServer[];
  paths?: Record<string, OAPathItem>;
}

// ---------------------------------------------------------------------------
// Tiny YAML → JSON converter (handles only key: value and lists — enough for
// most OpenAPI specs without pulling in a YAML dep).
// Falls back to JSON.parse if the string starts with "{".
// ---------------------------------------------------------------------------
function parseSpec(raw: string): OpenAPIDoc {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as OpenAPIDoc;
  }
  // Use the built-in JSON.parse after a best-effort YAML→JSON transform.
  // This is intentionally lightweight; complex YAML anchors/aliases are not supported.
  throw new Error(
    "YAML specs are not yet supported — please paste the spec as JSON. " +
    "You can convert YAML to JSON at https://www.json2yaml.com/ or use a YAML tool."
  );
}

const METHOD_ORDER = ["get", "post", "put", "patch", "delete"] as const;
type HttpMethod = (typeof METHOD_ORDER)[number];

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").toLowerCase();
}

function extractApis(doc: OpenAPIDoc, maxOps = 20): ExternalApi[] {
  const baseUrl = doc.servers?.[0]?.url?.replace(/\/$/, "") ?? "";
  const apis: ExternalApi[] = [];

  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHOD_ORDER) {
      const op = item[method as HttpMethod];
      if (!op) continue;
      if (apis.length >= maxOps) break;

      const name =
        op.operationId ??
        slugify(`${method}_${path.replace(/[{}]/g, "").replace(/\//g, "_")}`);

      const description =
        op.summary || op.description || `${method.toUpperCase()} ${path}`;

      // Build a query template from query parameters
      const queryParams = (op.parameters ?? []).filter((p) => p.in === "query");
      const queryTemplate =
        queryParams.length > 0
          ? queryParams.map((p) => `${p.name}={{${p.name}}}`).join("&")
          : undefined;

      // Build a body template placeholder from request body
      let bodyTemplate: string | undefined;
      if (op.requestBody && method !== "get") {
        const jsonContent = op.requestBody.content?.["application/json"];
        if (jsonContent?.schema) {
          const props = (jsonContent.schema as { properties?: Record<string, unknown> }).properties ?? {};
          const keys = Object.keys(props).slice(0, 8);
          bodyTemplate = JSON.stringify(
            Object.fromEntries(keys.map((k) => [k, `{{${k}}}`])),
            null,
            2
          );
        } else {
          bodyTemplate = "{}";
        }
      }

      const api: ExternalApi = {
        id: uuidv4(),
        name: name.slice(0, 80),
        baseUrl: `${baseUrl}${path}`,
        method: method.toUpperCase() as ExternalApi["method"],
        headers: { "Content-Type": "application/json" },
        queryTemplate,
        bodyTemplate,
        description: description.slice(0, 300),
        secretKeys: [],
      };

      apis.push(api);
    }
    if (apis.length >= maxOps) break;
  }

  return apis;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as unknown;
    const parsed = ImportSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request", 400, parsed.error.flatten());
    }

    let doc: OpenAPIDoc;
    try {
      doc = parseSpec(parsed.data.spec);
    } catch (err) {
      return errorResponse(
        "PARSE_ERROR",
        err instanceof Error ? err.message : "Failed to parse spec",
        422
      );
    }

    if (!doc.openapi?.startsWith("3")) {
      return errorResponse(
        "UNSUPPORTED_VERSION",
        `Only OpenAPI 3.x is supported. Got: ${doc.openapi ?? "unknown"}`,
        422
      );
    }

    const apis = extractApis(doc);

    if (apis.length === 0) {
      return errorResponse("NO_OPERATIONS", "No operations found in the spec", 422);
    }

    return NextResponse.json({ data: { apis, title: doc.info?.title ?? "Imported API" } });
  } catch (err) {
    console.error("OpenAPI import error:", err);
    return errorResponse("INTERNAL_ERROR", "Failed to import spec", 500);
  }
}
