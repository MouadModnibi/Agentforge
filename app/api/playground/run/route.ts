import { NextRequest, NextResponse } from "next/server";
import { agentsRepository } from "@/lib/repositories/agents";
import { runsRepository } from "@/lib/repositories/runs";
import { runAgent, setServerSandbox } from "@/lib/runtime/runAgent";
import { getServerSandbox } from "@/lib/sandbox/customToolRunner";
import { z } from "zod";

// Register sandbox once per server process
setServerSandbox(getServerSandbox());

const PlaygroundRunSchema = z.object({
  agentId: z.string().uuid(),
  input: z.record(z.string(), z.unknown()),
});

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PlaygroundRunSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request", 400, parsed.error.flatten());
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return errorResponse(
        "MISSING_API_KEY",
        "GOOGLE_GENERATIVE_AI_API_KEY is not configured. Add it to your .env.local file.",
        503
      );
    }

    const { agentId, input } = parsed.data;
    const agent = await agentsRepository.findById(agentId);
    if (!agent) return errorResponse("NOT_FOUND", "Agent not found", 404);

    const resources = await agentsRepository.getResources(agentId);

    const result = await runAgent({
      agentId,
      config: agent.config,
      input,
      resources: resources.map((r) => ({
        id: r.id,
        name: r.name,
        content: r.content,
        mimeType: r.mimeType,
        size: r.size,
      })),
      customTool: agent.customTool,
      externalApis: agent.externalApis,
      source: "playground",
    });

    // Persist run
    const run = await runsRepository.create({
      agentId,
      source: "playground",
      input,
      output: result.output,
      valid: result.valid,
      trace: result.trace,
      usage: result.usage,
      llmRequestCount: result.llmRequestCount,
      durationMs: result.durationMs,
      error: result.error,
    });

    return NextResponse.json({ data: { ...result, runId: run.id } });
  } catch (err) {
    console.error("Playground run error:", err);
    const message = err instanceof Error ? err.message : "Run failed";
    return errorResponse("RUN_FAILED", message, 500);
  }
}
