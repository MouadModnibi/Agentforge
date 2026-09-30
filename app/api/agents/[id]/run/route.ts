import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";
import { runsRepository } from "@/lib/repositories/runs";
import { RunRequestSchema } from "@/lib/schemas/run";
import { runAgent, setServerSandbox } from "@/lib/runtime/runAgent";
import { getServerSandbox } from "@/lib/sandbox/customToolRunner";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { hashApiKey } from "@/lib/security/secrets";

// Register sandbox once per server process
setServerSandbox(getServerSandbox());

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimitKey = `${ip}:${id}`;
  const rateLimit = checkRateLimit(rateLimitKey, 10);
  if (!rateLimit.allowed) {
    return errorResponse(
      "RATE_LIMITED",
      `Too many requests. Retry in ${Math.ceil(rateLimit.retryAfterMs / 1000)}s`,
      429
    );
  }

  try {
    const agent = await agentsRepository.findById(id);
    if (!agent) return errorResponse("NOT_FOUND", "Agent not found", 404);

    // Check API key if set
    if (agent.apiKeyHash) {
      const authHeader = req.headers.get("authorization");
      const providedKey = authHeader?.replace("Bearer ", "") || req.nextUrl.searchParams.get("apiKey");

      if (!providedKey || hashApiKey(providedKey) !== agent.apiKeyHash) {
        return errorResponse("UNAUTHORIZED", "Invalid or missing API key", 401);
      }
    }

    const body = await req.json();
    const parsed = RunRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request", 400, parsed.error.flatten());
    }

    // Check API key is configured
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return errorResponse(
        "MISSING_API_KEY",
        "GOOGLE_GENERATIVE_AI_API_KEY is not configured on the server",
        503
      );
    }

    // Fetch resources
    const resources = await agentsRepository.getResources(id);

    const result = await runAgent({
      agentId: id,
      config: agent.config,
      input: parsed.data.input,
      resources: resources.map((r) => ({
        id: r.id,
        name: r.name,
        content: r.content,
        mimeType: r.mimeType,
        size: r.size,
      })),
      customTool: agent.customTool,
      externalApis: agent.externalApis,
      source: "api",
    });

    // Persist run
    await runsRepository.create({
      agentId: id,
      source: "api",
      input: parsed.data.input,
      output: result.output,
      valid: result.valid,
      trace: result.trace,
      usage: result.usage,
      llmRequestCount: result.llmRequestCount,
      durationMs: result.durationMs,
      error: result.error,
    });

    return NextResponse.json({
      output: result.output,
      valid: result.valid,
      trace: result.trace,
      usage: result.usage,
    });
  } catch (err) {
    console.error("POST /api/agents/[id]/run error:", err);
    const message = err instanceof Error ? err.message : "Run failed";
    return errorResponse("RUN_FAILED", message, 500);
  }
}
